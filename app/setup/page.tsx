import { Badge, Card, SectionHeader } from "@/components/ui";
import { ImportPanel } from "@/components/setup/import-panel";
import { ThresholdsPanel } from "@/components/setup/thresholds-panel";
import { DEMO_TODAY, reps } from "@/lib/data/sample-data";
import { longDate } from "@/lib/format";

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Setup.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          How data reaches the dashboard, when the health signals fire, and who sees what. Everything here can be
          changed without a code release.
        </p>
      </div>

      <Card className="p-6">
        <SectionHeader title="Data source & freshness" />
        <div className="mt-4 flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-healthy" />
          <p className="text-ink">
            Last successful data update: {longDate(DEMO_TODAY.toISOString())}, 08:15 EAT
          </p>
        </div>
        <p className="mt-2 text-sm text-muted">
          If an import fails, we keep showing the last good update so stale data is obvious.
        </p>
        <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
          QuickBooks Desktop 2014 (UK) - scheduled &lsquo;Sales by Item Detail&rsquo; export &rarr; import. Figures are
          invoiced sales.
        </p>
      </Card>

      <ImportPanel />

      <ThresholdsPanel />

      <Card className="p-6">
        <SectionHeader title="Users & roles" />
        <ul className="mt-4 divide-y divide-line">
          {reps.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-3">
              <span className="text-ink">{r.name}</span>
              <Badge tone={r.role === "manager" ? "wine" : "neutral"}>{r.role === "manager" ? "Manager" : "Rep"}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          Managers see all customers and assign follow-ups. Reps see their own customers and submit visits.
        </p>
      </Card>
    </div>
  );
}
