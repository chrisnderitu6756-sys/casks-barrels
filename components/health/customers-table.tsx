"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, Card, HealthBadge, Trend, cx } from "@/components/ui";
import type { HealthStatus } from "@/lib/types";

export interface TableRow {
  id: string;
  name: string;
  type: string;
  area: string | null;
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
  const [type, setType] = useState<string | "all">("all");
  const [owner, setOwner] = useState<string | "all">("all");
  const [search, setSearch] = useState("");

  // Filter option lists are derived from the rows at runtime — distinct,
  // sorted, de-duplicated — so they always match the real data.
  const types = useMemo(
    () => Array.from(new Set(rows.map((r) => r.type).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const owners = useMemo(
    () => Array.from(new Set(rows.map((r) => r.ownerName).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (type === "all" || r.type === type) &&
        (owner === "all" || r.ownerName === owner) &&
        (q === "" || r.name.toLowerCase().includes(q)),
    );
  }, [rows, status, type, owner, search]);

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
        {types.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-xs uppercase tracking-wide text-faint">Type</span>
            <Chip active={type === "all"} onClick={() => setType("all")}>
              All types
            </Chip>
            {types.map((t) => (
              <Chip key={t} active={type === t} onClick={() => setType(type === t ? "all" : t)}>
                {t}
              </Chip>
            ))}
          </div>
        ) : null}
        {owners.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-xs uppercase tracking-wide text-faint">Owner</span>
            <Chip active={owner === "all"} onClick={() => setOwner("all")}>
              All owners
            </Chip>
            {owners.map((o) => (
              <Chip key={o} active={owner === o} onClick={() => setOwner(owner === o ? "all" : o)}>
                {o}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers by name…"
          aria-label="Search customers by name"
          className="w-full max-w-sm rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink placeholder:text-faint focus:border-wine focus:outline-none"
        />
        <span className="text-sm text-muted tabular-nums">
          {visible.length} customer{visible.length === 1 ? "" : "s"}
        </span>
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
                        {r.area ? `${r.type} · ${r.area}` : r.type}
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
