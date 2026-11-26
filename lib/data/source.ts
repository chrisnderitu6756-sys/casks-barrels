// Database-backed data access. Replaces the static sample-data imports: the app
// now reads live rows from Postgres. The health engine stays pure (it takes the
// data these functions return), so nothing about the UI or the flag logic changes.
//
// Dates are returned as ISO strings to match the domain types and the format
// helpers. `DEMO_TODAY` is re-exported from sample-data as the stable reference
// "today" the seeded history is anchored to.

import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type {
  Account,
  FollowUp,
  Order,
  OrderLine,
  Product,
  Rep,
  Route,
  Thresholds,
  Visit,
} from "@/lib/types";

export { DEMO_TODAY, visitLogging } from "./sample-data";

export async function getProducts(): Promise<Product[]> {
  return db.select().from(s.products).orderBy(asc(s.products.name));
}

export async function getReps(): Promise<Rep[]> {
  return db
    .select({ id: s.reps.id, name: s.reps.name, email: s.reps.email, role: s.reps.role })
    .from(s.reps);
}

export async function getRoutes(): Promise<Route[]> {
  return db.select().from(s.routes);
}

export async function getAccounts(): Promise<Account[]> {
  const rows = await db.select().from(s.accounts);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    area: r.area ?? null,
    route: r.route ?? null,
    ownerId: r.ownerId ?? "",
    parentId: r.parentId ?? undefined,
    cycleDays: r.cycleDays,
    knownServiceIssue: r.knownServiceIssue,
  }));
}

export async function getOrders(): Promise<Order[]> {
  const [orderRows, lineRows] = await Promise.all([
    db.select().from(s.orders),
    db.select().from(s.orderLines),
  ]);
  const linesByOrder = new Map<string, OrderLine[]>();
  for (const l of lineRows) {
    const list = linesByOrder.get(l.orderId) ?? [];
    list.push({ productId: l.productId, quantity: l.quantity, netAmount: l.netAmount });
    linesByOrder.set(l.orderId, list);
  }
  return orderRows.map((o) => ({
    id: o.id,
    number: o.number,
    accountId: o.accountId,
    date: o.date.toISOString(),
    docType: o.docType,
    lines: linesByOrder.get(o.id) ?? [],
  }));
}

export async function getVisits(): Promise<Visit[]> {
  const rows = await db.select().from(s.visits);
  return rows.map((v) => ({
    id: v.id,
    accountId: v.accountId,
    repId: v.repId,
    at: v.at.toISOString(),
    stockObs: v.stockObs,
    displayObs: v.displayObs,
    feedback: v.feedback,
    nextStep: v.nextStep,
  }));
}

export async function getFollowUps(): Promise<FollowUp[]> {
  const rows = await db.select().from(s.followUps);
  return rows.map((f) => ({
    id: f.id,
    accountId: f.accountId,
    action: f.action,
    ownerId: f.ownerId,
    reviewDate: f.reviewDate.toISOString(),
    status: f.status,
    declineReason: f.declineReason ?? undefined,
    createdAt: f.createdAt.toISOString(),
    fromVisitId: f.fromVisitId ?? undefined,
  }));
}

export async function getThresholds(): Promise<Thresholds> {
  const [row] = await db.select().from(s.thresholds).limit(1);
  return {
    stoppedDays: row?.stoppedDays ?? 35,
    changedCycleMultiplier: row?.changedCycleMultiplier ?? 1.5,
    reducedDropPct: row?.reducedDropPct ?? 0.3,
    minOrdersToAssess: row?.minOrdersToAssess ?? 3,
  };
}

export async function getLastImport(): Promise<{ at: string; source: string | null } | null> {
  const rows = await db
    .select()
    .from(s.importRuns)
    .orderBy(asc(s.importRuns.at));
  const last = rows[rows.length - 1];
  return last ? { at: last.at.toISOString(), source: last.source } : null;
}

/** Convenience: everything the dashboard reads, in one round of queries. */
export async function getDashboardData() {
  const [accounts, products, orders, reps, visits, followUps, thresholds] = await Promise.all([
    getAccounts(),
    getProducts(),
    getOrders(),
    getReps(),
    getVisits(),
    getFollowUps(),
    getThresholds(),
  ]);
  return { accounts, products, orders, reps, visits, followUps, thresholds };
}
