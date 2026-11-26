// Apply a committed QuickBooks sync to the live tables. Called only from
// /api/sync/commit. Everything runs in ONE transaction: if any step throws, the
// whole commit rolls back and the previous good data keeps showing.
//
// Mapping (per the agent contract):
//   customers  -> accounts, upsert by listId (= account id)
//   items      -> products, upsert by listId (= product id)
//   transactions -> orders (upsert by txnId) + orderLines (replaced per txn)
//   deletions  -> delete by (idType, id) — ONLY explicit deletions, never inferred
//   credit-memos already arrive sign-flipped (negative qty/amount), so they net
//   sales down automatically.
import { eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";

type Rec = Record<string, unknown>;

const DOC: Record<string, "invoice" | "sales-receipt" | "credit-note"> = {
  invoice: "invoice",
  "sales-receipt": "sales-receipt",
  "credit-memo": "credit-note",
};

// Item types that are real products. Everything else QuickBooks returns —
// Discount, Subtotal, SalesTax, Payment, Group, OtherCharge, FixedAsset — is not
// part of the product catalogue and must not pollute product insights.
const PRODUCT_TYPES = new Set(["Inventory", "NonInventory", "Service", "InventoryAssembly"]);

const str = (v: unknown): string => (v == null ? "" : String(v));
const norm = (v: string) => v.trim().toLowerCase();
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(str(v));
  return Number.isFinite(n) ? n : 0;
};
const slug = (v: string) =>
  v.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);

async function chunk<T>(rows: T[], size: number, fn: (c: T[]) => PromiseLike<unknown>) {
  for (let i = 0; i < rows.length; i += size) {
    const c = rows.slice(i, i + size);
    if (c.length) await fn(c);
  }
}

export interface ApplyResult {
  customers: number;
  items: number;
  transactions: number;
  lines: number;
  deletions: number;
}

export async function applyStagedSync(
  syncId: string,
  finishedAt: string,
  counts: Rec | null,
): Promise<ApplyResult> {
  // Gather staged records, concatenated in seq order within each entity.
  const batches = await db.select().from(s.syncBatches).where(eq(s.syncBatches.syncId, syncId));
  const byEntity: Record<string, Rec[]> = { customers: [], items: [], transactions: [], deletions: [] };
  for (const b of [...batches].sort((a, b) => (a.entity === b.entity ? a.seq - b.seq : a.entity < b.entity ? -1 : 1))) {
    (byEntity[b.entity] ??= []).push(...((b.records as Rec[]) ?? []));
  }
  const customers = byEntity.customers;
  const items = byEntity.items;
  const transactions = byEntity.transactions;
  const deletions = byEntity.deletions;

  const result: ApplyResult = { customers: 0, items: 0, transactions: 0, lines: 0, deletions: 0 };

  await db.transaction(async (tx) => {
    // 1) Reps — map each QuickBooks Sales Rep value to a rep id. QB usually emits
    //    the rep INITIALS (e.g. "EM"), sometimes the full name — match on EITHER
    //    the rep id (initials/code) or the rep name, so synced accounts land under
    //    the right login. Create a rep only when neither matches.
    const existingReps = await tx.select({ id: s.reps.id, name: s.reps.name }).from(s.reps);
    const repByKey = new Map<string, string>();
    for (const r of existingReps) {
      repByKey.set(norm(r.id), r.id);
      if (!repByKey.has(norm(r.name))) repByKey.set(norm(r.name), r.id);
    }
    const repIdFor = new Map<string, string>();
    const newReps: { id: string; name: string; email: null; passwordHash: null; role: "rep" }[] = [];
    for (const sr of new Set(customers.map((c) => str(c.salesRep)).filter(Boolean))) {
      const hit = repByKey.get(norm(sr));
      if (hit) {
        repIdFor.set(sr, hit);
      } else {
        const id = slug(sr) || `rep-${Math.random().toString(36).slice(2, 8)}`;
        repIdFor.set(sr, id);
        repByKey.set(norm(sr), id);
        repByKey.set(norm(id), id);
        newReps.push({ id, name: sr, email: null, passwordHash: null, role: "rep" });
      }
    }
    if (newReps.length) await tx.insert(s.reps).values(newReps).onConflictDoNothing();

    // 2) Customers -> accounts (upsert by listId).
    const accountRows = customers
      .filter((c) => c.listId)
      .map((c) => ({
        id: str(c.listId),
        name: str(c.fullName || c.name || c.listId),
        type: str(c.customerType) || "Uncategorised",
        area: c.billCity ? str(c.billCity) : null,
        route: null as string | null,
        ownerId: c.salesRep ? (repIdFor.get(str(c.salesRep)) ?? null) : null,
        parentId: c.parentListId ? str(c.parentListId) : null,
        cycleDays: 30,
        knownServiceIssue: false,
      }));
    await chunk(accountRows, 500, (c) =>
      tx
        .insert(s.accounts)
        .values(c)
        .onConflictDoUpdate({
          target: s.accounts.id,
          set: {
            name: sql`excluded.name`,
            type: sql`excluded.type`,
            area: sql`excluded.area`,
            ownerId: sql`excluded.owner_id`,
            parentId: sql`excluded.parent_id`,
          },
        }),
    );
    result.customers = accountRows.length;

    // 3) Items -> products (upsert by listId), real product types only.
    const productRows = items
      .filter((it) => it.listId && (!it.type || PRODUCT_TYPES.has(str(it.type))))
      .map((it) => ({
        id: str(it.listId),
        name: str(it.salesDesc || it.fullName || it.name || it.listId),
        supplier: "",
        unitPriceNet: num(it.salesPrice),
      }));
    await chunk(productRows, 500, (c) =>
      tx
        .insert(s.products)
        .values(c)
        .onConflictDoUpdate({
          target: s.products.id,
          set: { name: sql`excluded.name`, unitPriceNet: sql`excluded.unit_price_net` },
        }),
    );
    result.items = productRows.length;

    // 4) Transactions -> orders (+ lines). Ensure a referenced customer exists as
    //    an account even if it wasn't in this run's customer batch (incremental).
    const txns = transactions.filter((t) => t.txnId && t.customerListId && t.txnDate && DOC[str(t.txnType)]);
    const refCustomerIds = [...new Set(txns.map((t) => str(t.customerListId)))];
    if (refCustomerIds.length) {
      const present = await tx
        .select({ id: s.accounts.id })
        .from(s.accounts)
        .where(inArray(s.accounts.id, refCustomerIds));
      const have = new Set(present.map((r) => r.id));
      const stubs = txns
        .filter((t) => !have.has(str(t.customerListId)))
        .reduce((m, t) => {
          const id = str(t.customerListId);
          if (!m.has(id))
            m.set(id, {
              id,
              name: str(t.customerFullName || id),
              type: "Uncategorised",
              area: null,
              route: null,
              ownerId: null,
              parentId: null,
              cycleDays: 30,
              knownServiceIssue: false,
            });
          return m;
        }, new Map<string, typeof s.accounts.$inferInsert>());
      await chunk([...stubs.values()], 500, (c) => tx.insert(s.accounts).values(c).onConflictDoNothing());
    }

    const orderRows = txns.map((t) => ({
      id: str(t.txnId),
      number: str(t.refNumber),
      accountId: str(t.customerListId),
      date: new Date(str(t.txnDate)),
      docType: DOC[str(t.txnType)]!,
    }));
    await chunk(orderRows, 500, (c) =>
      tx
        .insert(s.orders)
        .values(c)
        .onConflictDoUpdate({
          target: s.orders.id,
          set: {
            number: sql`excluded.number`,
            accountId: sql`excluded.account_id`,
            date: sql`excluded.date`,
            docType: sql`excluded.doc_type`,
          },
        }),
    );
    result.transactions = orderRows.length;

    // Lines: replace every applied order's lines (a txn edit can change them).
    // Only keep lines that reference a TRACKED PRODUCT — transaction lines can
    // point at non-product items (delivery, discount, VAT, subtotal); those are
    // skipped so product insights and uptake stay clean.
    const txnIds = orderRows.map((o) => o.id);
    await chunk(txnIds, 500, (c) => tx.delete(s.orderLines).where(inArray(s.orderLines.orderId, c)));

    // Valid product ids = products upserted this run, plus any already in the DB
    // that these lines reference (incremental runs may not resend every item).
    const productIds = new Set(productRows.map((p) => p.id));
    const lineItemIds = [
      ...new Set(
        txns.flatMap((t) =>
          (Array.isArray(t.lines) ? (t.lines as Rec[]) : []).map((l) => str(l.itemListId)).filter(Boolean),
        ),
      ),
    ].filter((id) => !productIds.has(id));
    await chunk(lineItemIds, 500, async (c) => {
      const have = await tx.select({ id: s.products.id }).from(s.products).where(inArray(s.products.id, c));
      for (const r of have) productIds.add(r.id);
    });

    const lineRows = txns.flatMap((t) => {
      const oid = str(t.txnId);
      const lines = Array.isArray(t.lines) ? (t.lines as Rec[]) : [];
      return lines
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => productIds.has(str(l.itemListId)))
        .map(({ l, i }) => ({
          id: `${oid}-${str(l.txnLineId) || i + 1}`,
          orderId: oid,
          productId: str(l.itemListId),
          quantity: Math.round(num(l.quantity)),
          netAmount: Math.round(num(l.amountNet) * 100) / 100,
        }));
    });
    await chunk(lineRows, 800, (c) => tx.insert(s.orderLines).values(c).onConflictDoNothing());
    result.lines = lineRows.length;

    // 5) Deletions — only the explicit ones. (idType, id) is the reliable signal.
    for (const d of deletions) {
      const id = str(d.id);
      if (!id) continue;
      if (d.idType === "txnId") {
        await tx.delete(s.orders).where(eq(s.orders.id, id)); // cascades lines
      } else {
        await tx.delete(s.accounts).where(eq(s.accounts.id, id)); // cascades orders + lines
        await tx.delete(s.products).where(eq(s.products.id, id));
      }
      result.deletions++;
    }

    // 6) Freshness + close the session.
    await tx.insert(s.importRuns).values({
      id: `sync-${Date.now()}`,
      at: new Date(finishedAt),
      status: "success",
      ordersImported: typeof counts?.transactions === "number" ? (counts.transactions as number) : txns.length,
      source: "QuickBooks live sync",
      message: `${result.customers} customers, ${result.items} items, ${result.transactions} txns, ${result.deletions} deletions`,
    });
    await tx
      .update(s.syncSessions)
      .set({ status: "committed", finishedAt: new Date(finishedAt), counts: counts ?? null })
      .where(eq(s.syncSessions.id, syncId));
  });

  // Clear the staged batches now that they're applied.
  await db.delete(s.syncBatches).where(eq(s.syncBatches.syncId, syncId));

  return result;
}
