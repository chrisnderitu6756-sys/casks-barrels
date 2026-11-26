// Shared server-side selectors for the Customer Health module.
import { DEMO_TODAY, getDashboardData } from "@/lib/data/source";
import { healthByAccount } from "@/lib/health";
import type { Account, AccountHealth } from "@/lib/types";

export interface Row {
  account: Account;
  health: AccountHealth;
  ownerName: string;
  headlineName: string | null;
}

export async function getRows(): Promise<Row[]> {
  const { accounts, orders, reps, products, thresholds } = await getDashboardData();
  const repById = new Map(reps.map((r) => [r.id, r]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const healths = healthByAccount(accounts, orders, { today: DEMO_TODAY, thresholds });
  return accounts.map((account) => {
    const health = healths.get(account.id)!;
    return {
      account,
      health,
      ownerName: repById.get(account.ownerId)?.name ?? "Unassigned",
      headlineName: health.headline ? (productById.get(health.headline.productId)?.name ?? null) : null,
    };
  });
}

/** At-risk + service-issue accounts, biggest headline drop first. */
export function getAttention(rows: Row[]): Row[] {
  return rows
    .filter((r) => r.health.status === "at-risk" || r.health.status === "service-issue")
    .sort((a, b) => (a.health.headline?.pctChange ?? 0) - (b.health.headline?.pctChange ?? 0));
}
