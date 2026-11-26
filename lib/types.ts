// ---------------------------------------------------------------------------
// Casks & Barrels — Phase 1 domain model
// Read-only "invoiced sales" from QuickBooks + field activity (visits, follow-ups).
// Designed so a live QuickBooks connector can replace the sample data behind the
// same shapes without a rebuild.
// ---------------------------------------------------------------------------

// Real QuickBooks values are free-form (e.g. "Hotels", "Liquour Store/Bar",
// "Supermarkets", "Restaurants", "Camps"), so these are open strings, not unions.
export type Area = string;
export type AccountType = string;
export type UserRole = "manager" | "rep";

/** Health classification shown across the dashboard. */
export type HealthStatus = "healthy" | "at-risk" | "service-issue" | "learning";

/** Buying-pattern flags. Every flag must open to its evidence. */
export type FlagType = "reduced" | "changed-cycle" | "stopped";

export interface Rep {
  id: string;
  name: string;
  email?: string | null;
  role: UserRole;
}

export interface Product {
  id: string;
  name: string;
  supplier: string;
  /** Net price per unit (bottle), KES. */
  unitPriceNet: number;
}

export interface OrderLine {
  productId: string;
  quantity: number;
  /** Net amount for the line, KES (ex-VAT). */
  netAmount: number;
}

/** An invoiced sale. NB: invoiced sales, never treated as deliveries. */
export interface Order {
  id: string;
  number: string;
  accountId: string;
  /** ISO date. */
  date: string;
  docType: "invoice" | "sales-receipt" | "credit-note";
  lines: OrderLine[];
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** Delivery area / route. QuickBooks doesn't carry it, so it's null until a
   *  rep assigns the account to a route. */
  area?: string | null;
  route?: string | null;
  /** Rep id who owns the relationship ("" when unassigned). */
  ownerId: string;
  /** Parent account id when this is a QuickBooks sub-account / branch. */
  parentId?: string;
  /** Usual order interval in days (fallback when history is thin). */
  cycleDays: number;
  /** A service/operational problem recorded in the team's records. */
  knownServiceIssue?: boolean;
}

export interface Visit {
  id: string;
  accountId: string;
  repId: string;
  /** ISO datetime. */
  at: string;
  stockObs: string;
  displayObs: string;
  feedback: string;
  nextStep: string;
}

export type FollowUpStatus = "open" | "closed";

export interface FollowUp {
  id: string;
  accountId: string;
  action: string;
  ownerId: string;
  /** ISO date the follow-up should be reviewed by. */
  reviewDate: string;
  status: FollowUpStatus;
  /** Customer's reason for a decline, from the team's records only. */
  declineReason?: string;
  createdAt: string;
  fromVisitId?: string;
}

/** Health thresholds — configurable by a manager, never hard-coded. */
export interface Thresholds {
  /** days since last order >= this ⇒ "stopped" (James: 35). */
  stoppedDays: number;
  /** days since last order > the account's typical cycle * this (but < stoppedDays)
   *  ⇒ "changed-cycle". */
  changedCycleMultiplier: number;
  /** a product's uptake drop >= this (0–1) ⇒ "reduced" (James: 0.30). */
  reducedDropPct: number;
  /** fewer completed orders than this ⇒ "learning". */
  minOrdersToAssess: number;
}

/** A delivery route a rep covers; drives route-coverage reporting. */
export interface Route {
  id: string;
  name: string;
  ownerId: string | null;
  active: boolean;
}

// ---- Computed health -------------------------------------------------------

export interface ProductUptake {
  productId: string;
  /** Average quantity over the last 2 completed orders containing it. */
  recentAvg: number;
  /** Average quantity over the prior (up to 6) orders. */
  priorAvg: number;
  /** (recentAvg - priorAvg) / priorAvg, e.g. -0.64. */
  pctChange: number;
}

export interface AccountHealth {
  accountId: string;
  status: HealthStatus;
  flags: FlagType[];
  lastOrderDate: string | null;
  daysSinceLastOrder: number | null;
  orderCount: number;
  /** Per-product uptake, worst (most negative) first. */
  uptake: ProductUptake[];
  /** The standout product by magnitude of change — drives the headline line. */
  headline?: ProductUptake;
}
