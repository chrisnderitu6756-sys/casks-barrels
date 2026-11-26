import { Card, Trend } from "@/components/ui";
import { FLAG_LABEL } from "@/lib/health";
import { productById } from "@/lib/data/sample-data";
import { longDate } from "@/lib/format";
import type { Account, AccountHealth, FlagType } from "@/lib/types";

function CycleEvidence({ account, health, flag }: { account: Account; health: AccountHealth; flag: FlagType }) {
  const days = health.daysSinceLastOrder ?? 0;
  return (
    <div className="mt-4 grid grid-cols-2 gap-6">
      <div>
        <div className="font-display text-4xl tabular-nums text-risk">{days}</div>
        <div className="mt-1 text-sm text-muted">days since last order{health.lastOrderDate ? ` (${longDate(health.lastOrderDate)})` : ""}</div>
      </div>
      <div>
        <div className="font-display text-4xl tabular-nums text-ink">{account.cycleDays}</div>
        <div className="mt-1 text-sm text-muted">days is their usual cycle</div>
      </div>
      <p className="col-span-2 text-sm text-muted">
        {flag === "stopped"
          ? "It has been well beyond their usual rhythm — worth checking in directly."
          : "A little past their usual reorder window."}
      </p>
    </div>
  );
}

function ReducedEvidence({ health }: { health: AccountHealth }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-faint">
            <th className="pb-2 font-medium">Product</th>
            <th className="pb-2 text-right font-medium">Prior avg</th>
            <th className="pb-2 text-right font-medium">Recent avg</th>
            <th className="pb-2 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {health.uptake.map((u) => (
            <tr key={u.productId}>
              <td className="py-2.5 text-ink">{productById(u.productId)?.name ?? u.productId}</td>
              <td className="py-2.5 text-right tabular-nums text-muted">{Math.round(u.priorAvg * 10) / 10}</td>
              <td className="py-2.5 text-right tabular-nums text-ink">{Math.round(u.recentAvg * 10) / 10}</td>
              <td className="py-2.5 text-right">
                <Trend pct={u.pctChange} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FlagEvidence({ account, health }: { account: Account; health: AccountHealth }) {
  if (health.flags.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted">
          {health.status === "learning"
            ? "Not enough completed orders yet to assess a pattern. We are still building a baseline."
            : "No flags — this customer is on their usual rhythm."}
        </p>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {health.flags.map((flag) => (
        <Card key={flag} className={flag === "reduced" ? "p-6 md:col-span-2" : "p-6"}>
          <div className="text-xs uppercase tracking-wide text-faint">Flag</div>
          <h3 className="font-display text-xl text-ink">{FLAG_LABEL[flag]}</h3>
          {flag === "reduced" ? <ReducedEvidence health={health} /> : <CycleEvidence account={account} health={health} flag={flag} />}
        </Card>
      ))}
    </div>
  );
}
