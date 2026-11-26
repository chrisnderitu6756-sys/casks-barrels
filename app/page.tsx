import Link from "next/link";
import { Card, SectionHeader, Trend } from "@/components/ui";
import { AttentionList } from "@/components/health/attention-list";
import { PortfolioStats } from "@/components/health/portfolio-stats";
import { getAttention, getRows } from "@/components/health/portfolio";
import { DEMO_TODAY, getAccounts, getFollowUps, getReps } from "@/lib/data/source";
import { longDate, shortDate, signedPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [rows, followUps, accounts, reps] = await Promise.all([getRows(), getFollowUps(), getAccounts(), getReps()]);
  const accountById = (id: string) => accounts.find((a) => a.id === id);
  const repById = (id: string) => reps.find((r) => r.id === id);
  const attention = getAttention(rows);
  const worst = attention[0];
  const open = followUps.filter((f) => f.status === "open").sort((a, b) => (a.reviewDate < b.reviewDate ? -1 : 1));
  const wh = worst?.health.headline;

  return (
    <div className="mx-auto max-w-5xl space-y-12 pb-12">
      <header>
        <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
          A little foresight. Stronger relationships.
        </h1>
        <p className="mt-3 text-lg text-muted">
          Your customer briefing for {longDate(DEMO_TODAY.toISOString())}.
        </p>
      </header>

      {worst && wh ? (
        <Card className="border-wine/15 bg-wine-soft/60 p-6 sm:p-8">
          <p className="font-display text-2xl leading-snug text-ink sm:text-3xl">
            {attention.length} customer relationships need a closer look. Start with{" "}
            <span className="text-wine">{worst.account.name}</span> — its {worst.headlineName} uptake is down{" "}
            {signedPct(Math.abs(wh.pctChange)).replace("+", "")}.
          </p>
          <Link
            href={`/customers/${worst.account.id}`}
            className="mt-5 inline-flex items-center gap-1 rounded-full bg-wine px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Review account →
          </Link>
        </Card>
      ) : null}

      <PortfolioStats rows={rows} />

      <section className="space-y-4">
        <SectionHeader
          title="Worth your attention"
          intro="Accounts where the buying pattern has shifted, largest change first."
          action={
            <Link href="/customers" className="shrink-0 text-sm font-medium text-wine hover:underline">
              Explore all customers →
            </Link>
          }
        />
        <AttentionList rows={attention} />
      </section>

      {worst && wh ? (
        <section>
          <Card className="overflow-hidden">
            <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1.1fr_1fr]">
              <div>
                <h2 className="font-display text-2xl text-ink sm:text-3xl">A smaller order can tell a bigger story</h2>
                <p className="mt-3 text-muted">
                  {worst.account.name} still orders on schedule, but the {worst.headlineName} line has quietly shrunk.
                  Other wine purchases remain stable.
                </p>
                <Link
                  href={`/customers/${worst.account.id}`}
                  className="mt-5 inline-block text-sm font-medium text-wine hover:underline"
                >
                  See the evidence →
                </Link>
              </div>
              <div className="flex items-center justify-around gap-4 rounded-2xl bg-surface-2 p-6">
                <div className="text-center">
                  <div className="font-display text-5xl tabular-nums text-ink">{Math.round(wh.priorAvg)}</div>
                  <div className="mt-1 text-xs text-muted">usual bottles per order</div>
                </div>
                <span aria-hidden className="text-2xl text-faint">→</span>
                <div className="text-center">
                  <div className="font-display text-5xl tabular-nums text-risk">{Math.round(wh.recentAvg)}</div>
                  <div className="mt-1 text-xs text-muted">most recent</div>
                  <Trend pct={wh.pctChange} className="mt-1" />
                </div>
              </div>
            </div>
            <div className="border-t border-line bg-surface-2 px-6 py-3 text-xs text-faint sm:px-8">
              Based on sample order history · cause unconfirmed.
            </div>
          </Card>
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          title="Follow-ups in motion"
          intro={`${open.length} open follow-up${open.length === 1 ? "" : "s"} across the team.`}
          action={
            <Link href="/follow-ups" className="shrink-0 text-sm font-medium text-wine hover:underline">
              Open follow-up board →
            </Link>
          }
        />
        <Card className="divide-y divide-line">
          {open.slice(0, 3).map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">{accountById(f.accountId)?.name}</div>
                <div className="truncate text-sm text-muted">{f.action}</div>
              </div>
              <div className="shrink-0 text-right text-sm">
                <div className="text-ink">{repById(f.ownerId)?.name}</div>
                <div className="text-faint">Review {shortDate(f.reviewDate)}</div>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <footer className="border-t border-line pt-6 text-sm text-faint">
        Today, 08:15 EAT · All customers and figures are fictional.
      </footer>
    </div>
  );
}
