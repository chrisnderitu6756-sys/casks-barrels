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

/** One row per data refresh — drives the "last updated" freshness stamp. */
export const importRuns = pgTable("import_runs", {
  id: text("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull(),
  ordersImported: integer("orders_imported").default(0).notNull(),
  source: text("source"),
  message: text("message"),
});
