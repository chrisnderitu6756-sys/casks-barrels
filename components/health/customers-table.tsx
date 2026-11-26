"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, Card, HealthBadge, Trend, cx } from "@/components/ui";
import type { Area, HealthStatus } from "@/lib/types";

export interface TableRow {
  id: string;
  name: string;
  type: string;
  area: Area;
  status: HealthStatus;
  cycleDays: number;
  daysSinceLastOrder: number | null;
  overdue: boolean;
  headlineName: string | null;
  headlinePct: number | null;
  ownerName: string;
}

const STATUS_FILTERS: { value: HealthStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "at-risk", label: "At risk" },
  { value: "healthy", label: "Healthy" },
  { value: "service-issue", label: "Service issue" },
  { value: "learning", label: "Learning" },
];
const AREA_FILTERS: (Area | "all")[] = ["all", "Westlands", "Kilimani", "Karen"];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active ? "border-wine bg-wine text-white" : "border-line bg-surface text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function CustomersTable({ rows }: { rows: TableRow[] }) {
  const [status, setStatus] = useState<HealthStatus | "all">("all");
  const [area, setArea] = useState<Area | "all">("all");

  const visible = useMemo(
    () => rows.filter((r) => (status === "all" || r.status === status) && (area === "all" || r.area === area)),
    [rows, status, area],
  );

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 text-xs uppercase tracking-wide text-faint">Status</span>
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.value} active={status === f.value} onClick={() => setStatus(f.value)}>
              {f.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 text-xs uppercase tracking-wide text-faint">Area</span>
          {AREA_FILTERS.map((a) => (
            <Chip key={a} active={area === a} onClick={() => setArea(a)}>
              {a === "all" ? "All" : a}
            </Chip>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[2.2fr_1fr_0.8fr_0.9fr_1.6fr_1fr] gap-4 border-b border-line bg-surface-2 px-5 py-3 text-xs uppercase tracking-wide text-faint md:grid">
          <div>Customer</div>
          <div>Status</div>
          <div>Usual cycle</div>
          <div>Since last order</div>
          <div>Headline uptake</div>
          <div>Owner</div>
        </div>
        {visible.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted">No customers match these filters.</div>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/customers/${r.id}`}
                  className="grid items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-2 md:grid-cols-[2.2fr_1fr_0.8fr_0.9fr_1.6fr_1fr]"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={r.name} />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{r.name}</div>
                      <div className="truncate text-sm text-muted">
                        {r.type} · {r.area}
                      </div>
                    </div>
                  </div>
                  <div>
                    <HealthBadge status={r.status} />
                  </div>
                  <div className="text-sm text-ink">{r.cycleDays} days</div>
                  <div className={cx("text-sm", r.overdue ? "font-semibold text-risk" : "text-ink")}>
                    {r.daysSinceLastOrder != null ? `${r.daysSinceLastOrder} days` : "—"}
                  </div>
                  <div className="text-sm">
                    {r.status === "learning" || r.headlinePct == null ? (
                      <span className="text-faint">Not enough data</span>
                    ) : (
                      <span className="flex flex-wrap items-center gap-x-2">
                        <span className="text-muted">{r.headlineName}</span>
                        <Trend pct={r.headlinePct} />
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted">{r.ownerName}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
