"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, SectionHeader, Stat } from "@/components/ui";
import { DEMO_TODAY } from "@/lib/data/sample-data";
import { DEFAULT_THRESHOLDS, healthByAccount } from "@/lib/health";
import type { Account, Order, Thresholds } from "@/lib/types";
import { saveThresholds } from "./actions";

interface Field {
  key: keyof Thresholds;
  label: string;
  hint: string;
  step: number;
  min: number;
  /** Display scale: stored value * scale = shown value. */
  scale: number;
}

const FIELDS: Field[] = [
  {
    key: "changedCycleMultiplier",
    label: "Days-since-last-order multiplier for 'reorder overdue'",
    hint: "Flag when days since the last order exceed the usual cycle times this.",
    step: 0.1,
    min: 1,
    scale: 1,
  },
  {
    key: "stoppedCycleMultiplier",
    label: "Days-since-last-order multiplier for 'stopped ordering'",
    hint: "Flag as stopped when days since the last order exceed the usual cycle times this.",
    step: 0.1,
    min: 1,
    scale: 1,
  },
  {
    key: "reducedDropPct",
    label: "Uptake drop that counts as 'buying less' (%)",
    hint: "A product's recent average quantity falling by at least this much.",
    step: 1,
    min: 1,
    scale: 100,
  },
  {
    key: "minOrdersToAssess",
    label: "Orders needed before we assess an account",
    hint: "Accounts with fewer invoiced orders stay in 'Learning'.",
    step: 1,
    min: 1,
    scale: 1,
  },
];

export function ThresholdsPanel({
  accounts,
  orders,
  initial = DEFAULT_THRESHOLDS,
}: {
  accounts: Account[];
  orders: Order[];
  initial?: Thresholds;
}) {
  const [t, setT] = useState<Thresholds>(initial);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const h = [...healthByAccount(accounts, orders, { today: DEMO_TODAY, thresholds: t }).values()];
    const by = (s: string) => h.filter((x) => x.status === s).length;
    return {
      atRisk: by("at-risk"),
      service: by("service-issue"),
      learning: by("learning"),
      healthy: by("healthy"),
      flagged: h.filter((x) => x.flags.length > 0).length,
    };
  }, [t, accounts, orders]);

  const changed = FIELDS.some((f) => t[f.key] !== initial[f.key]);

  function save() {
    setSaved(false);
    startTransition(async () => {
      await saveThresholds(t);
      setSaved(true);
    });
  }

  return (
    <Card className="p-6">
      <SectionHeader
        title="Health thresholds"
        intro="Thresholds are configurable without a code change."
        action={
          changed ? (
            <button
              type="button"
              onClick={() => {
                setT(initial);
                setSaved(false);
              }}
              className="text-sm text-wine hover:underline"
            >
              Reset
            </button>
          ) : undefined
        }
      />

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-sm font-medium text-ink">{f.label}</span>
            <input
              type="number"
              inputMode="decimal"
              min={f.min}
              step={f.step}
              value={Math.round(t[f.key] * f.scale * 100) / 100}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isFinite(v) || v < f.min) return;
                setT({ ...t, [f.key]: v / f.scale });
              }}
              className="mt-2 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-wine/30"
            />
            <span className="mt-1 block text-xs text-faint">{f.hint}</span>
          </label>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-surface-2 p-5">
        <div className="mb-4 text-sm text-muted">
          With these thresholds, {counts.flagged} of {accounts.length} accounts would carry a buying-pattern flag.
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat value={counts.atRisk} label="At risk" />
          <Stat value={counts.service} label="Service issue" />
          <Stat value={counts.learning} label="Learning" />
          <Stat value={counts.healthy} label="Healthy" />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || !changed}
          onClick={save}
          className="rounded-full bg-wine px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save thresholds"}
        </button>
        {saved ? <span className="text-sm text-healthy">Saved — health recalculated across the dashboard.</span> : null}
      </div>
    </Card>
  );
}
