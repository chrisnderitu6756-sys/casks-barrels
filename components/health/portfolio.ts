// Shared server-side selectors for the Customer Health module.
import { accounts, DEMO_TODAY, orders, productById, repById } from "@/lib/data/sample-data";
import { healthByAccount } from "@/lib/health";
import type { Account, AccountHealth } from "@/lib/types";

export interface Row {
  account: Account;
  health: AccountHealth;
  ownerName: string;
  headlineName: string | null;
}

export function getRows(): Row[] {
  const healths = healthByAccount(accounts, orders, { today: DEMO_TODAY });
  return accounts.map((account) => {
    const health = healths.get(account.id)!;
    return {
      account,
      health,
      ownerName: repById(account.ownerId)?.name ?? "Unassigned",
      headlineName: health.headline ? (productById(health.headline.productId)?.name ?? null) : null,
    };
  });
}

/** At-risk + service-issue accounts, biggest headline drop first. */
export function getAttention(rows: Row[]): Row[] {
  return rows
    .filter((r) => r.health.status === "at-risk" || r.health.status === "service-issue")
    .sort((a, b) => (a.health.headline?.pctChange ?? 0) - (b.health.headline?.pctChange ?? 0));
}
