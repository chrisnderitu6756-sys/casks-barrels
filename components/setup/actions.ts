"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { parseSalesByItemDetail, slugify } from "@/lib/import/sales-by-item-detail";
import type { Thresholds } from "@/lib/types";

/**
 * Commit a QuickBooks "Sales by Item Detail" export to the database. This is
 * what turns Setup → Import from a preview into a real refresh: parsed accounts,
 * products and orders are written (existing rows are left untouched), and an
 * import run is recorded so the freshness stamp updates.
 *
 * Imports are additive and idempotent: re-running the same export inserts
 * nothing new (every row conflicts on its primary key and is skipped).
 */
export async function commitImport(
  csvText: string,
  sourceName?: string,
): Promise<{ ok: boolean; ordersImported: number; message: string }> {
  const result = parseSalesByItemDetail(csvText);

  if (!result.orders.length) {
    return { ok: false, ordersImported: 0, message: "No orders found in the export." };
  }
  if (!result.stats.hasQuantity) {
    return {
      ok: false,
      ordersImported: 0,
      message: "This export has no quantity column, so it cannot drive health analysis. Re-export with quantities.",
    };
  }

  // 1. New customers — imported accounts get sensible defaults; a manager can
  //    refine type/area/owner later. Existing accounts are left as they are.
  const newAccounts = result.accounts
    .filter((a) => !a.matchedExisting)
    .map((a) => ({
      id: a.id,
      name: a.name,
      type: "Retailer" as const,
      area: "Westlands" as const,
      ownerId: null,
      parentId: a.parentId ?? null,
      cycleDays: 30,
      knownServiceIssue: false,
    }));
  if (newAccounts.length) {
    await db.insert(s.accounts).values(newAccounts).onConflictDoNothing();
  }

  // 2. Products not yet in the catalogue — keyed by the importer's unmatched id.
  const newProducts = result.stats.unmatchedProducts.map((name) => ({
    id: `unmatched-${slugify(name)}`,
    name,
    supplier: "Unmatched (from import)",
    unitPriceNet: 0,
  }));
  if (newProducts.length) {
    await db.insert(s.products).values(newProducts).onConflictDoNothing();
  }

  // 3. Orders + their lines.
  await db
    .insert(s.orders)
    .values(
      result.orders.map((o) => ({
        id: o.id,
        number: o.number,
        accountId: o.accountId,
        date: new Date(o.date),
        docType: o.docType,
      })),
    )
    .onConflictDoNothing();

  const lines = result.orders.flatMap((o) =>
    o.lines.map((l, i) => ({
      id: `${o.id}-l${i + 1}`,
      orderId: o.id,
      productId: l.productId,
      quantity: l.quantity,
      netAmount: l.netAmount,
    })),
  );
  if (lines.length) {
    await db.insert(s.orderLines).values(lines).onConflictDoNothing();
  }

  // 4. Record the refresh so the freshness stamp reflects it.
  await db.insert(s.importRuns).values({
    id: `import-${Date.now()}`,
    at: new Date(),
    status: "success",
    ordersImported: result.orders.length,
    source: sourceName ?? "QuickBooks Sales by Item Detail",
    message: `${result.orders.length} orders, ${result.accounts.length} customers`,
  });

  // Everything the dashboard reads could have changed.
  for (const path of ["/", "/customers", "/products", "/visits", "/follow-ups", "/setup"]) {
    revalidatePath(path);
  }

  return {
    ok: true,
    ordersImported: result.orders.length,
    message: `Imported ${result.orders.length} orders across ${result.accounts.length} customers.`,
  };
}

/** Persist the configurable health thresholds (single-row settings table). */
export async function saveThresholds(t: Thresholds): Promise<{ ok: boolean }> {
  await db
    .insert(s.thresholds)
    .values({ id: 1, ...t })
    .onConflictDoUpdate({ target: s.thresholds.id, set: t });

  for (const path of ["/", "/customers", "/products", "/setup"]) {
    revalidatePath(path);
  }
  return { ok: true };
}
