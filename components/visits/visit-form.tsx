"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Visit } from "@/lib/types";
import { accounts, accountById, repById, reps, visits as seedVisits, DEMO_TODAY } from "@/lib/data/sample-data";
import { shortDate } from "@/lib/format";
import { Avatar, Badge, Card, SectionHeader, cx } from "@/components/ui";

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** datetime-local value in Nairobi time (deterministic across server/client). */
function toLocalInput(d: Date): string {
  return new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 16);
}
function fromLocalInput(v: string): string {
  const d = new Date(`${v}:00+03:00`);
  return Number.isNaN(d.getTime()) ? DEMO_TODAY.toISOString() : d.toISOString();
}

const defaultRep = reps.find((r) => r.role === "rep") ?? reps[0];
const sortedAccounts = [...accounts].sort((a, b) => a.name.localeCompare(b.name));

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-faint focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/20";

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-risk">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function VisitForm() {
  const [list, setList] = useState<Visit[]>(seedVisits);
  const [accountId, setAccountId] = useState("");
  const [repId, setRepId] = useState(defaultRep.id);
  const [when, setWhen] = useState(() => toLocalInput(DEMO_TODAY));
  const [stockObs, setStockObs] = useState("");
  const [displayObs, setDisplayObs] = useState("");
  const [feedback, setFeedback] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ name: string; followUp: boolean } | null>(null);

  const recent = useMemo(() => [...list].sort((a, b) => (a.at < b.at ? 1 : -1)), [list]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!accountId) {
      setError("Please choose a customer.");
      setNotice(null);
      return;
    }
    const visit: Visit = {
      id: `local-${Date.now()}`,
      accountId,
      repId,
      at: fromLocalInput(when),
      stockObs: stockObs.trim(),
      displayObs: displayObs.trim(),
      feedback: feedback.trim(),
      nextStep: nextStep.trim(),
    };
    setList((l) => [visit, ...l]);
    setNotice({ name: accountById(accountId)?.name ?? "customer", followUp: followUp && !!nextStep.trim() });
    setAccountId("");
    setWhen(toLocalInput(DEMO_TODAY));
    setStockObs("");
    setDisplayObs("");
    setFeedback("");
    setNextStep("");
    setFollowUp(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-8">
      {notice ? (
        <div role="status" className="rounded-2xl border border-healthy/30 bg-healthy/10 px-4 py-3 text-sm text-ink">
          <p className="font-medium text-healthy">Visit logged for {notice.name}</p>
          {notice.followUp ? <p className="mt-0.5 text-muted">A follow-up was queued from this visit.</p> : null}
        </div>
      ) : null}

      <Card className="p-4 sm:p-6">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Field label="Customer" htmlFor="customer" error={error}>
            <select
              id="customer"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setError("");
              }}
              aria-invalid={!!error}
              className={cx(inputCls, "min-h-12", error && "border-risk")}
            >
              <option value="">Select a customer…</option>
              {sortedAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.type} · {a.area}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Rep" htmlFor="rep">
              <select id="rep" value={repId} onChange={(e) => setRepId(e.target.value)} className={cx(inputCls, "min-h-12")}>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Visit date & time" htmlFor="when">
              <input
                id="when"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className={cx(inputCls, "min-h-12")}
              />
            </Field>
          </div>

          <Field label="Stock observations" htmlFor="stock">
            <textarea id="stock" rows={3} value={stockObs} onChange={(e) => setStockObs(e.target.value)} placeholder="What is on the shelf or in the cellar?" className={inputCls} />
          </Field>
          <Field label="Display observations" htmlFor="display">
            <textarea id="display" rows={3} value={displayObs} onChange={(e) => setDisplayObs(e.target.value)} placeholder="Wine list, shelf, promo materials…" className={inputCls} />
          </Field>
          <Field label="Customer feedback" htmlFor="feedback">
            <textarea id="feedback" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What did they say?" className={inputCls} />
          </Field>
          <Field label="Next step" htmlFor="next">
            <input id="next" type="text" value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="e.g. Call owner on Friday" className={cx(inputCls, "min-h-12")} />
          </Field>

          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink">
            <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} className="h-5 w-5 accent-wine" />
            Create a follow-up from this
          </label>

          <button
            type="submit"
            className="min-h-14 w-full rounded-xl bg-wine px-6 py-4 text-base font-semibold text-white shadow-sm transition active:scale-[0.99] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-wine/40"
          >
            Submit visit
          </button>
        </form>
      </Card>

      <section className="space-y-3">
        <SectionHeader title="Recent visits" intro={`${recent.length} logged`} />
        <ul className="space-y-3">
          {recent.map((v) => {
            const acc = accountById(v.accountId);
            const rep = repById(v.repId);
            const snippet = v.feedback || v.nextStep || v.stockObs;
            return (
              <li key={v.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-ink">{acc?.name ?? "Unknown account"}</p>
                    <span className="shrink-0 text-xs text-faint">{shortDate(v.at)}</span>
                  </div>
                  {rep ? (
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted">
                      <Avatar name={rep.name} className="h-7 w-7 text-[10px]" />
                      {rep.name}
                    </div>
                  ) : null}
                  {snippet ? <p className="mt-2 text-sm text-ink">{snippet}</p> : null}
                  {v.nextStep && v.feedback ? (
                    <p className="mt-2">
                      <Badge tone="gold">Next: {v.nextStep}</Badge>
                    </p>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
