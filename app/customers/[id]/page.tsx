import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Card, HealthBadge, SectionHeader } from "@/components/ui";
import { FlagEvidence } from "@/components/health/flag-evidence";
import { RhythmChart } from "@/components/health/rhythm-chart";
import { accountById, accounts, DEMO_TODAY, orders as allOrders, ordersByAccount, productById, repById } from "@/lib/data/sample-data";
import { computeAccountHealth } from "@/lib/health";
import { kes, shortDate } from "@/lib/format";

export function generateStaticParams() {
  return accounts.map((account) => ({ id: account.id }));
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = accountById(id);
  if (!account) notFound();

  const health = computeAccountHealth(account, allOrders, { today: DEMO_TODAY });
  const orders = ordersByAccount(id);
  const owner = repById(account.ownerId);
  const recent = [...orders].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-12">
      <Link href="/customers" className="text-sm text-muted hover:text-ink">
        ← All customers
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">{account.name}</h1>
          <p className="mt-2 text-muted">
            {account.type} · {account.area}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {owner ? (
            <div className="flex items-center gap-2.5">
              <Avatar name={owner.name} />
              <div className="text-sm leading-tight">
                <div className="text-xs text-faint">Relationship owner</div>
                <div className="font-medium text-ink">{owner.name}</div>
              </div>
            </div>
          ) : null}
          <HealthBadge status={health.status} />
        </div>
      </header>

      <section className="space-y-4">
        <SectionHeader title="What the flags are based on" intro="Every flag opens to the numbers behind it." />
        <FlagEvidence account={account} health={health} />
      </section>

      <section>
        <Card className="p-6 sm:p-8">
          <h2 className="font-display text-2xl text-ink">
            Every customer has a rhythm — {account.name} · bottles per completed order
          </h2>
          <p className="mb-4 mt-1 text-sm text-muted">Last 2 vs prior 6 orders, by product quantity.</p>
          <RhythmChart orders={orders} />
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Recent purchases" intro="Latest invoiced sales, newest first." />
        <Card className="divide-y divide-line">
          {recent.map((o) => (
            <div key={o.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[110px_1fr_auto] sm:items-center sm:gap-6">
              <div>
                <div className="font-medium text-ink">{shortDate(o.date)}</div>
                <div className="text-xs text-faint">Invoice #{o.number}</div>
              </div>
              <div className="text-sm text-muted">
                {o.lines.map((l) => `${productById(l.productId)?.name ?? l.productId} × ${l.quantity}`).join(" · ")}
              </div>
              <div className="font-medium tabular-nums text-ink sm:text-right">
                {kes(o.lines.reduce((s, l) => s + l.netAmount, 0))}
              </div>
            </div>
          ))}
        </Card>
      </section>

      <p className="text-sm text-faint">Based on sample order history · cause unconfirmed.</p>
    </div>
  );
}
