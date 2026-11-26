// ---------------------------------------------------------------------------
// Casks & Barrels — Phase 1 domain model
// Read-only "invoiced sales" from QuickBooks + field activity (visits, follow-ups).
// Designed so a live QuickBooks connector can replace the sample data behind the
// same shapes without a rebuild.
// ---------------------------------------------------------------------------

export type Area = "Westlands" | "Kilimani" | "Karen";
export type AccountType = "Restaurant" | "Bar & lounge" | "Hotel" | "Retailer";
export type UserRole = "manager" | "rep";

/** Health classification shown across the dashboard. */
export type HealthStatus = "healthy" | "at-risk" | "service-issue" | "learning";

/** Buying-pattern flags. Every flag must open to its evidence. */
export type FlagType = "reduced" | "changed-cycle" | "stopped";

export interface Rep {
  id: string;
  name: string;
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
  docType: "invoice" | "sales-receipt";
  lines: OrderLine[];
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  area: Area;
  /** Rep id who owns the relationship. */
  ownerId: string;
  /** Parent account id when this is a QuickBooks sub-account / job. */
  parentId?: string;
  /** Usual order interval in days. */
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
  /** days since last order > cycle * this ⇒ "stopped". */
  stoppedCycleMultiplier: number;
  /** days since last order > cycle * this ⇒ "changed-cycle". */
  changedCycleMultiplier: number;
  /** a product's uptake drop >= this (0–1) ⇒ "reduced". */
  reducedDropPct: number;
  /** fewer completed orders than this ⇒ "learning". */
  minOrdersToAssess: number;
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
