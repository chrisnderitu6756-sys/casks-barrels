// ---------------------------------------------------------------------------
// Customer health engine.
// Flags are COMPUTED from invoiced-sales history against configurable thresholds,
// so every flag can open to its evidence. Uptake compares the last 2 completed
// orders with the prior 6, by product quantity.
// ---------------------------------------------------------------------------

import type {
  Account,
  AccountHealth,
  FlagType,
  HealthStatus,
  Order,
  ProductUptake,
  Thresholds,
} from "./types";

export const DEFAULT_THRESHOLDS: Thresholds = {
  stoppedDays: 35, // James: no sales in 35+ days ⇒ gone quiet
  changedCycleMultiplier: 1.5,
  reducedDropPct: 0.3, // James: a usual order down by 30%+ ⇒ buying less
  minOrdersToAssess: 3,
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export interface HealthOptions {
  thresholds?: Thresholds;
  /** Reference "today" — pass the demo clock for a stable demo. */
  today?: Date;
}

export function computeAccountHealth(
  account: Account,
  orders: Order[],
  options: HealthOptions = {},
): AccountHealth {
  const t = options.thresholds ?? DEFAULT_THRESHOLDS;
  const today = options.today ?? new Date();

  // Credit notes are returns, not purchases — excluding them keeps the buying
  // signal (cadence, last order, uptake) from going negative/absurd. They stay
  // in the data for net-sales views elsewhere.
  const accountOrders = orders
    .filter((o) => o.accountId === account.id && o.docType !== "credit-note")
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const orderCount = accountOrders.length;
  const lastOrderDate = orderCount ? accountOrders[orderCount - 1]!.date : null;
  const daysSinceLastOrder = lastOrderDate
    ? Math.round((today.getTime() - new Date(lastOrderDate).getTime()) / 86_400_000)
    : null;

  const productIds = [...new Set(accountOrders.flatMap((o) => o.lines.map((l) => l.productId)))];
  const qtyOf = (o: Order, pid: string) =>
    o.lines.filter((l) => l.productId === pid).reduce((s, l) => s + l.quantity, 0);

  const uptake: ProductUptake[] = productIds
    .map((pid) => {
      const withProduct = accountOrders.filter((o) => o.lines.some((l) => l.productId === pid));
      const recent = withProduct.slice(-2).map((o) => qtyOf(o, pid));
      const prior = withProduct
        .slice(0, -2)
        .slice(-6)
        .map((o) => qtyOf(o, pid));
      const recentAvg = avg(recent);
      const priorAvg = avg(prior);
      const pctChange = priorAvg ? (recentAvg - priorAvg) / priorAvg : 0;
      return { productId: pid, recentAvg, priorAvg, pctChange };
    })
    .sort((a, b) => a.pctChange - b.pctChange);

  const headline = uptake.length
    ? [...uptake].sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange))[0]
    : undefined;

  // Typical reorder interval: the median gap between this account's own orders,
  // falling back to the configured cycle when history is thin. This lets
  // "reorder overdue" respect each account's natural rhythm.
  const gaps: number[] = [];
  for (let i = 1; i < accountOrders.length; i++) {
    const prev = new Date(accountOrders[i - 1]!.date).getTime();
    const cur = new Date(accountOrders[i]!.date).getTime();
    gaps.push((cur - prev) / 86_400_000);
  }
  const typicalCycle = gaps.length
    ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]!
    : account.cycleDays;

  const flags: FlagType[] = [];
  const assessable = orderCount >= t.minOrdersToAssess;
  if (assessable) {
    const worstDrop = uptake.length ? uptake[0]!.pctChange : 0;
    if (worstDrop <= -t.reducedDropPct) flags.push("reduced");
    if (daysSinceLastOrder != null) {
      if (daysSinceLastOrder >= t.stoppedDays) flags.push("stopped");
      else if (daysSinceLastOrder > typicalCycle * t.changedCycleMultiplier)
        flags.push("changed-cycle");
    }
  }

  let status: HealthStatus;
  if (!assessable) status = "learning";
  else if (flags.length === 0) status = "healthy";
  else if (account.knownServiceIssue) status = "service-issue";
  else status = "at-risk";

  return {
    accountId: account.id,
    status,
    flags,
    lastOrderDate,
    daysSinceLastOrder,
    orderCount,
    uptake,
    headline,
  };
}

export function healthByAccount(
  accounts: Account[],
  orders: Order[],
  options: HealthOptions = {},
): Map<string, AccountHealth> {
  return new Map(accounts.map((a) => [a.id, computeAccountHealth(a, orders, options)]));
}

export const STATUS_ORDER: HealthStatus[] = ["at-risk", "service-issue", "learning", "healthy"];

export const STATUS_LABEL: Record<HealthStatus, string> = {
  healthy: "Healthy",
  "at-risk": "At risk",
  "service-issue": "Service issue",
  learning: "Learning",
};

export const FLAG_LABEL: Record<FlagType, string> = {
  reduced: "Buying less",
  "changed-cycle": "Reorder overdue",
  stopped: "Stopped ordering",
};

export function portfolioSummary(healths: AccountHealth[]) {
  const by = (s: HealthStatus) => healths.filter((h) => h.status === s).length;
  return {
    total: healths.length,
    healthy: by("healthy"),
    atRisk: by("at-risk"),
    serviceIssue: by("service-issue"),
    learning: by("learning"),
  };
}
