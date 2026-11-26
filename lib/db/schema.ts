// Drizzle schema — Postgres tables mirroring the Phase 1 domain model.
// The app reads/writes these; a seed loads the illustrative sample data, and
// the QuickBooks "Sales by Item Detail" importer writes orders/accounts here.

import {
  pgTable,
  pgEnum,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["manager", "rep"]);
// Customer type and area are free-form text (real QuickBooks values vary widely),
// so they are plain text columns rather than enums.
export const docTypeEnum = pgEnum("doc_type", ["invoice", "sales-receipt", "credit-note"]);
export const followUpStatusEnum = pgEnum("follow_up_status", ["open", "closed"]);

/** Users — managers and reps. passwordHash present for sign-in accounts. */
export const reps = pgTable("reps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  role: roleEnum("role").notNull(),
});

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  supplier: text("supplier").notNull(),
  unitPriceNet: doublePrecision("unit_price_net").notNull(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  area: text("area"),
  route: text("route"),
  ownerId: text("owner_id").references(() => reps.id),
  parentId: text("parent_id"),
  cycleDays: integer("cycle_days").notNull(),
  knownServiceIssue: boolean("known_service_issue").default(false).notNull(),
});

/** Delivery routes a rep covers — reps enter these; drives route-coverage. */
export const routes = pgTable("routes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id"),
  active: boolean("active").default(true).notNull(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  number: text("number").notNull(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  date: timestamp("date", { withTimezone: true }).notNull(),
  docType: docTypeEnum("doc_type").notNull(),
});

export const orderLines = pgTable("order_lines", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  netAmount: doublePrecision("net_amount").notNull(),
});

export const visits = pgTable("visits", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  repId: text("rep_id").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull(),
  stockObs: text("stock_obs").default("").notNull(),
  displayObs: text("display_obs").default("").notNull(),
  feedback: text("feedback").default("").notNull(),
  nextStep: text("next_step").default("").notNull(),
});

export const followUps = pgTable("follow_ups", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  action: text("action").notNull(),
  ownerId: text("owner_id").notNull(),
  reviewDate: timestamp("review_date", { withTimezone: true }).notNull(),
  status: followUpStatusEnum("status").notNull().default("open"),
  declineReason: text("decline_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  fromVisitId: text("from_visit_id"),
});

/** Single-row settings: the configurable health thresholds. */
export const thresholds = pgTable("thresholds", {
  id: integer("id").primaryKey(),
  stoppedDays: integer("stopped_days").notNull(),
  changedCycleMultiplier: doublePrecision("changed_cycle_multiplier").notNull(),
  reducedDropPct: doublePrecision("reduced_drop_pct").notNull(),
  minOrdersToAssess: integer("min_orders_to_assess").notNull(),
});

// ---------------------------------------------------------------------------
// Live QuickBooks sync (the on-site agent POSTs here; see app/api/sync/*).
// A session is opened at /start, batches are STAGED (never applied) at /batch,
// and only /commit applies them atomically. If commit never arrives, the staged
// session is discarded and the previous good data keeps showing.
// ---------------------------------------------------------------------------

/** One sync session opened by the on-site agent. */
export const syncSessions = pgTable("sync_sessions", {
  id: text("id").primaryKey(), // the syncId
  syncType: text("sync_type").notNull(), // "full" | "incremental"
  since: timestamp("since", { withTimezone: true }),
  pollSeconds: integer("poll_seconds"), // the agent's configured cadence (heartbeat window)
  status: text("status").notNull().default("open"), // open | committed | discarded
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  counts: jsonb("counts"),
});

/** A staged batch page, keyed by (syncId, entity, seq) so a resend overwrites
 *  rather than duplicates. Records are stored raw until commit. */
export const syncBatches = pgTable(
  "sync_batches",
  {
    syncId: text("sync_id").notNull(),
    entity: text("entity").notNull(), // customers | items | transactions | deletions
    seq: integer("seq").notNull(),
    records: jsonb("records").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.syncId, table.entity, table.seq] }),
  }),
);

/** One row per data refresh — drives the "last updated" freshness stamp. */
export const importRuns = pgTable("import_runs", {
  id: text("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull(),
  ordersImported: integer("orders_imported").default(0).notNull(),
  source: text("source"),
  message: text("message"),
  // For live-sync runs: the agent's poll cadence, so the dashboard's staleness
  // window auto-tunes (amber ~3x, red ~10x). Null for manual imports.
  pollSeconds: integer("poll_seconds"),
});
