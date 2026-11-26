"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { getViewer } from "@/lib/data/scope";

/**
 * One-time go-live cutover. The dashboard currently holds data loaded from
 * James's .xlsx export (keyed by our own ids); the live QuickBooks agent keys
 * everything by QuickBooks id, with no shared key, so the two can't merge. This
 * clears the export-loaded customers/products/orders so the agent's FIRST full
 * sync reloads everything cleanly from QuickBooks.
 *
 * Guarded: manager only, and the caller must type the confirmation word. The
 * actual delete only runs on that explicit confirmation — never automatically.
 * Team logins, thresholds, routes, visits and follow-ups are kept.
 */
export async function resetForFirstSync(
  confirmation: string,
): Promise<{ ok: boolean; message: string }> {
  const viewer = await getViewer();
  if (!viewer.isManager) {
    return { ok: false, message: "Only a manager can run the go-live reset." };
  }
  if (confirmation.trim().toUpperCase() !== "RESET") {
    return { ok: false, message: "Type RESET to confirm." };
  }

  const [a] = await db.select({ n: sql<number>`count(*)::int` }).from(s.accounts);
  const [p] = await db.select({ n: sql<number>`count(*)::int` }).from(s.products);

  await db.delete(s.accounts); // cascades orders + order lines
  await db.delete(s.products);

  await db.insert(s.importRuns).values({
    id: `reset-${Date.now()}`,
    at: new Date(),
    status: "reset",
    ordersImported: 0,
    source: "Go-live reset — cleared for first sync",
    message: `Cleared ${a?.n ?? 0} customers and ${p?.n ?? 0} products; awaiting first QuickBooks sync.`,
  });

  for (const path of ["/", "/customers", "/products", "/setup"]) revalidatePath(path);

  return {
    ok: true,
    message: `Cleared ${a?.n ?? 0} customers and ${p?.n ?? 0} products. The next full QuickBooks sync will load fresh data.`,
  };
}
