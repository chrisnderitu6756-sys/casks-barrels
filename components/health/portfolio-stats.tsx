import { HealthDot, Card } from "@/components/ui";
import { portfolioSummary } from "@/lib/health";
import type { HealthStatus } from "@/lib/types";
import type { Row } from "./portfolio";

const ITEMS: { status: HealthStatus; key: "healthy" | "atRisk" | "serviceIssue" | "learning"; label: string; note: string }[] = [
  { status: "healthy", key: "healthy", label: "Healthy", note: "On their usual rhythm" },
  { status: "at-risk", key: "atRisk", label: "At risk", note: "Ready for a conversation" },
  { status: "service-issue", key: "serviceIssue", label: "Service issue", note: "An operational fix first" },
  { status: "learning", key: "learning", label: "Learning", note: "Building a baseline" },
];

export function PortfolioStats({ rows }: { rows: Row[] }) {
  const s = portfolioSummary(rows.map((r) => r.health));
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Card className="col-span-2 p-5 lg:col-span-1">
        <div className="font-display text-4xl text-ink tabular-nums">{s.total}</div>
        <div className="mt-1 text-sm font-medium text-ink">Sample accounts</div>
        <div className="text-xs text-faint">Across Westlands, Kilimani &amp; Karen</div>
      </Card>
      {ITEMS.map((it) => (
        <Card key={it.status} className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <HealthDot status={it.status} />
            {it.label}
          </div>
          <div className="mt-2 font-display text-4xl text-ink tabular-nums">{s[it.key]}</div>
          <div className="mt-1 text-xs text-muted">{it.note}</div>
        </Card>
      ))}
    </div>
  );
}
