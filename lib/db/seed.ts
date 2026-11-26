import bcrypt from "bcryptjs";
import { db } from "./index";
import * as s from "./schema";
import {
  accounts as sampleAccounts,
  products as sampleProducts,
  orders as sampleOrders,
  reps as sampleReps,
  visits as sampleVisits,
  followUps as sampleFollowUps,
  DEMO_TODAY,
} from "../data/sample-data";
import { DEFAULT_THRESHOLDS } from "../health";

/** Shared demo password for every seeded user. Change after go-live. */
export const DEMO_PASSWORD = "casks1234";

/**
 * Idempotent seed: loads the illustrative sample data into the database the
 * first time only (skips if accounts already exist). Users get a demo password
 * so the role-based login can be tried immediately.
 */
export async function seedDatabase() {
  const existing = await db.select({ id: s.accounts.id }).from(s.accounts).limit(1);
  if (existing.length > 0) return { seeded: false as const };

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await db.insert(s.reps).values(
    sampleReps.map((r) => ({
      id: r.id,
      name: r.name,
      email: `${r.id}@casksandbarrels.demo`,
      passwordHash,
      role: r.role,
    })),
  );

  await db.insert(s.products).values(
    sampleProducts.map((p) => ({
      id: p.id,
      name: p.name,
      supplier: p.supplier,
      unitPriceNet: p.unitPriceNet,
    })),
  );

  await db.insert(s.accounts).values(
    sampleAccounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      area: a.area,
      ownerId: a.ownerId,
      parentId: a.parentId ?? null,
      cycleDays: a.cycleDays,
      knownServiceIssue: a.knownServiceIssue ?? false,
    })),
  );

  await db.insert(s.orders).values(
    sampleOrders.map((o) => ({
      id: o.id,
      number: o.number,
      accountId: o.accountId,
      date: new Date(o.date),
      docType: o.docType,
    })),
  );

  await db.insert(s.orderLines).values(
    sampleOrders.flatMap((o) =>
      o.lines.map((l, i) => ({
        id: `${o.id}-l${i + 1}`,
        orderId: o.id,
        productId: l.productId,
        quantity: l.quantity,
        netAmount: l.netAmount,
      })),
    ),
  );

  await db.insert(s.visits).values(
    sampleVisits.map((v) => ({
      id: v.id,
      accountId: v.accountId,
      repId: v.repId,
      at: new Date(v.at),
      stockObs: v.stockObs,
      displayObs: v.displayObs,
      feedback: v.feedback,
      nextStep: v.nextStep,
    })),
  );

  await db.insert(s.followUps).values(
    sampleFollowUps.map((f) => ({
      id: f.id,
      accountId: f.accountId,
      action: f.action,
      ownerId: f.ownerId,
      reviewDate: new Date(f.reviewDate),
      status: f.status,
      declineReason: f.declineReason ?? null,
      createdAt: new Date(f.createdAt),
      fromVisitId: f.fromVisitId ?? null,
    })),
  );

  await db.insert(s.thresholds).values({ id: 1, ...DEFAULT_THRESHOLDS });

  await db.insert(s.importRuns).values({
    id: "seed",
    at: DEMO_TODAY,
    status: "success",
    ordersImported: sampleOrders.length,
    source: "Illustrative sample data",
    message: "Initial seed",
  });

  return {
    seeded: true as const,
    accounts: sampleAccounts.length,
    orders: sampleOrders.length,
  };
}
