"use client";

import Link from "next/link";
import { useState } from "react";
import type { FollowUp } from "@/lib/types";
import {
  accountById,
  accounts,
  DEMO_TODAY,
  followUps as seedFollowUps,
  repById,
  reps,
  visitLogging,
  visits,
} from "@/lib/data/sample-data";
import { daysBetween, shortDate } from "@/lib/format";
import { Avatar, Badge, Card, SectionHeader, Stat, cx } from "@/components/ui";

type Filter = "all" | "open" | "overdue" | "closed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-wine/30";
const btnCls =
  "rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-2";
const primaryBtnCls =
  "rounded-full bg-wine px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40";

const dateOnly = (iso: string) => iso.slice(0, 10);
const isOverdue = (f: FollowUp) => f.status === "open" && new Date(f.reviewDate) < DEMO_TODAY;

export function FollowUpBoard() {
  const [items, setItems] = useState<FollowUp[]>(seedFollowUps);
  const [filter, setFilter] = useState<Filter>("all");
  const [closingId, setClosingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const overdueCount = items.filter(isOverdue).length;
  const openCount = items.filter((f) => f.status === "open" && !isOverdue(f)).length;
  const closedCount = items.filter((f) => f.status === "closed").length;

  const visible = items.filter((f) => {
    if (filter === "all") return true;
    if (filter === "closed") return f.status === "closed";
    if (filter === "overdue") return isOverdue(f);
    return f.status === "open" && !isOverdue(f);
  });

  const update = (id: string, patch: Partial<FollowUp>) =>
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const confirmClose = (id: string) => {
    const trimmed = reason.trim();
    update(id, { status: "closed", declineReason: trimmed || undefined });
    setClosingId(null);
    setReason("");
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <Stat value={openCount} label="open" hint="On track" />
        </Card>
        <Card className="p-5">
          <Stat value={<span className={overdueCount ? "text-risk" : ""}>{overdueCount}</span>} label="overdue" hint="Past review date" />
        </Card>
        <Card className="p-5">
          <Stat value={closedCount} label="closed" hint="Resolved" />
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter follow-ups">
            {FILTERS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={filter === t.key}
                onClick={() => setFilter(t.key)}
                className={cx(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  filter === t.key ? "bg-wine-soft text-wine" : "text-muted hover:bg-surface-2",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button type="button" className={primaryBtnCls} onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? "Cancel" : "Add follow-up"}
          </button>
        </div>

        {showAdd ? (
          <AddForm
            onAdd={(f) => {
              setItems((prev) => [f, ...prev]);
              setShowAdd(false);
            }}
          />
        ) : null}

        {visible.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted">Nothing here right now.</Card>
        ) : (
          <div className="space-y-3">
            {visible.map((f) => {
              const account = accountById(f.accountId);
              const owner = repById(f.ownerId);
              const overdue = isOverdue(f);
              const visit = f.fromVisitId ? visits.find((v) => v.id === f.fromVisitId) : undefined;
              const closing = closingId === f.id;
              return (
                <Card key={f.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/customers/${f.accountId}`}
                        className="font-display text-lg text-ink hover:text-wine"
                      >
                        {account?.name ?? f.accountId}
                      </Link>
                      <p className="mt-1 text-sm text-ink">{f.action}</p>
                      {visit ? (
                        <p className="mt-1 text-xs text-faint">From a visit on {shortDate(visit.at)}</p>
                      ) : null}
                      {f.status === "closed" && f.declineReason ? (
                        <p className="mt-2 text-xs text-muted">
                          <span className="font-medium">Reason recorded:</span> {f.declineReason}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {overdue ? (
                        <span className="text-xs font-medium text-risk">
                          Overdue by {daysBetween(DEMO_TODAY, new Date(f.reviewDate))} days
                        </span>
                      ) : (
                        <span className="text-xs text-muted">Review {shortDate(f.reviewDate)}</span>
                      )}
                      <Badge tone={f.status === "closed" ? "neutral" : overdue ? "wine" : "gold"}>
                        {f.status === "closed" ? "Closed" : overdue ? "Overdue" : "Open"}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-line pt-4">
                    <div className="flex items-center gap-2">
                      <Avatar name={owner?.name ?? "?"} className="h-8 w-8" />
                      <label className="text-xs text-muted">
                        Owner
                        <select
                          className={cx(inputCls, "mt-0.5 block w-auto py-1.5")}
                          value={f.ownerId}
                          onChange={(e) => update(f.id, { ownerId: e.target.value })}
                        >
                          {reps.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="text-xs text-muted">
                      Review date
                      <input
                        type="date"
                        className={cx(inputCls, "mt-0.5 block w-auto py-1.5")}
                        value={dateOnly(f.reviewDate)}
                        onChange={(e) => e.target.value && update(f.id, { reviewDate: e.target.value })}
                      />
                    </label>
                    <div className="ml-auto flex gap-2">
                      {f.status === "open" ? (
                        <button
                          type="button"
                          className={btnCls}
                          onClick={() => {
                            setClosingId(closing ? null : f.id);
                            setReason("");
                          }}
                        >
                          Mark closed
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={btnCls}
                          onClick={() => update(f.id, { status: "open", declineReason: undefined })}
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>

                  {closing ? (
                    <div className="mt-4 space-y-2 rounded-xl bg-surface-2 p-4">
                      <label className="block text-xs text-muted">
                        Decline reason (optional — only what the team has recorded)
                        <textarea
                          rows={2}
                          className={cx(inputCls, "mt-1")}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      <div className="flex gap-2">
                        <button type="button" className={primaryBtnCls} onClick={() => confirmClose(f.id)}>
                          Close follow-up
                        </button>
                        <button type="button" className={btnCls} onClick={() => setClosingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Visit logging rate"
          intro="Share of planned visits logged per rep — the weekly adoption review."
        />
        <Card className="divide-y divide-line">
          {visitLogging.map((v) => {
            const name = repById(v.repId)?.name ?? v.repId;
            const pct = v.planned ? Math.round((v.logged / v.planned) * 100) : 0;
            return (
              <div key={v.repId} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <Avatar name={name} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink">
                    {name}: {v.logged}/{v.planned} visits logged
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-wine" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="w-12 text-right text-sm font-semibold tabular-nums text-ink">{pct}%</div>
              </div>
            );
          })}
        </Card>
      </section>
    </div>
  );
}

function AddForm({ onAdd }: { onAdd: (f: FollowUp) => void }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [action, setAction] = useState("");
  const [ownerId, setOwnerId] = useState(reps[0]?.id ?? "");
  const [reviewDate, setReviewDate] = useState(dateOnly(DEMO_TODAY.toISOString()));

  const valid = accountId && action.trim() && ownerId && reviewDate;

  return (
    <Card className="p-5">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onAdd({
            id: `f-new-${Date.now()}`,
            accountId,
            action: action.trim(),
            ownerId,
            reviewDate,
            status: "open",
            createdAt: DEMO_TODAY.toISOString(),
          });
        }}
      >
        <label className="text-xs text-muted">
          Account
          <select className={cx(inputCls, "mt-1")} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Owner
          <select className={cx(inputCls, "mt-1")} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted sm:col-span-2">
          Action
          <input className={cx(inputCls, "mt-1")} value={action} onChange={(e) => setAction(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Review date
          <input
            type="date"
            className={cx(inputCls, "mt-1")}
            value={reviewDate}
            onChange={(e) => setReviewDate(e.target.value)}
          />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={!valid} className={primaryBtnCls}>
            Add follow-up
          </button>
        </div>
      </form>
    </Card>
  );
}
