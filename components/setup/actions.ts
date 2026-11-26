"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { parseSalesByItemDetail, slugify } from "@/lib/import/sales-by-item-detail";
import { parseGroupedSalesRows, type Cell } from "@/lib/import/sales-xlsx";
import type { Thresholds } from "@/lib/types";

/** Insert `rows` in batches so a big export never exceeds Postgres' parameter cap. */
async function chunkedInsert<T>(table: any, rows: T[], size = 800): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    if (batch.length) await db.insert(table).values(batch).onConflictDoNothing();
  }
}

/**
 * Import the client's REAL QuickBooks "Sales by Item Detail" .xlsx export.
 *
 * This is the primary refresh path: a manager uploads the Excel file QuickBooks
 * Desktop produces and the live dashboard updates. The data sheet ("Sheet1") is
 * grouped by item with spacer columns, section headers and "Total …" subtotal
 * rows; `parseGroupedSalesRows` turns the real transaction rows into orders.
 *
 * Writes are additive and idempotent — every row conflicts on its primary key
 * and is skipped, so re-uploading the same (or an overlapping) export is safe.
 * Existing accounts keep their real type/owner/area; only brand-new customers
 * get the "Uncategorised"/null defaults.
 */
export async function importSalesXlsx(formData: FormData): Promise<{
  ok: boolean;
  ordersImported: number;
  accounts: number;
  products: number;
  message: string;
}> {
  try {
    const file = formData.get("file") as File | null;
    if (!file || typeof file.arrayBuffer !== "function") {
      return { ok: false, ordersImported: 0, accounts: 0, products: 0, message: "No file was uploaded." };
    }

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });

    const sheet = wb.Sheets["Sheet1"] ?? wb.Sheets[wb.SheetNames[wb.SheetNames.length - 1]];
    if (!sheet) {
      return { ok: false, ordersImported: 0, accounts: 0, products: 0, message: "The workbook has no data sheet (expected a sheet named \"Sheet1\")." };
    }

    const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: null });
    const parsed = parseGroupedSalesRows(rows);

    if (!parsed.orders.length) {
      return {
        ok: false,
        ordersImported: 0,
        accounts: 0,
        products: 0,
        message:
          "No transactions found in this file. Expected a QuickBooks \"Sales by Item Detail\" export with Invoice / Sales Receipt / Credit Note rows.",
      };
    }

    // Which accounts already exist? Existing rows are left untouched; this only
    // lets us report an accurate "new customers" count.
    const accountIds = parsed.accounts.map((a) => a.id);
    const existing = accountIds.length
      ? await db
          .select({ id: s.accounts.id })
          .from(s.accounts)
          .where(inArray(s.accounts.id, accountIds))
      : [];
    const existingIds = new Set(existing.map((r) => r.id));
    const newAccounts = parsed.accounts.filter((a) => !existingIds.has(a.id));

    // 1) Products — representative positive unit price; supplier filled in later.
    await chunkedInsert(
      s.products,
      parsed.products.map((p) => ({
        id: p.id,
        name: p.name,
        supplier: "",
        unitPriceNet: p.unitPriceNet,
      })),
      500,
    );

    // 2) Accounts — brand-new customers get sensible defaults (existing ones are
    //    skipped by onConflictDoNothing, keeping their real type/owner/area).
    await chunkedInsert(
      s.accounts,
      parsed.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: "Uncategorised",
        area: null,
        route: null,
        ownerId: null,
        parentId: a.parentId,
        cycleDays: 30,
        knownServiceIssue: false,
      })),
      500,
    );

    // 3) Orders + their lines.
    await chunkedInsert(
      s.orders,
      parsed.orders.map((o) => ({
        id: o.id,
        number: o.number,
        accountId: o.accountId,
        date: new Date(o.iso),
        docType: o.docType,
      })),
      800,
    );

    const lines = parsed.orders.flatMap((o) =>
      o.lines.map((l, i) => ({
        id: `${o.id}-l${i + 1}`,
        orderId: o.id,
        productId: l.productId,
        quantity: Math.round(l.quantity || 0),
        netAmount: Math.round((l.netAmount || 0) * 100) / 100,
      })),
    );
    await chunkedInsert(s.orderLines, lines, 800);

    // 4) Record the refresh so the freshness stamp updates.
    await db.insert(s.importRuns).values({
      id: `import-${Date.now()}`,
      at: new Date(),
      status: "success",
      ordersImported: parsed.orders.length,
      source: "QuickBooks Sales by Item Detail (upload)",
      message: `${parsed.orders.length} orders, ${newAccounts.length} new customers`,
    });

    for (const path of ["/", "/customers", "/products", "/setup"]) {
      revalidatePath(path);
    }

    return {
      ok: true,
      ordersImported: parsed.orders.length,
      accounts: newAccounts.length,
      products: parsed.products.length,
      message: `Imported ${parsed.orders.length} orders (${parsed.rowsImported} lines) across ${parsed.accounts.length} customers — ${newAccounts.length} new.`,
    };
  } catch (err) {
    return {
      ok: false,
      ordersImported: 0,
      accounts: 0,
      products: 0,
      message: err instanceof Error ? err.message : "Could not read the uploaded file.",
    };
  }
}

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
      type: "Uncategorised",
      area: null,
      route: null,
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
