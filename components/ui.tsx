// Shared presentational primitives so every module reads as one system.
// Server-safe (no hooks). Colours come from the design tokens in globals.css.

import type { ReactNode } from "react";
import type { HealthStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/health";
import { initials, signedPct } from "@/lib/format";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-line bg-surface", className)}>{children}</div>;
}

export function SectionHeader({
  title,
  intro,
  action,
}: {
  title: string;
  intro?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-xl text-ink">{title}</h2>
        {intro ? <p className="mt-1 text-sm text-muted">{intro}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({ value, label, hint }: { value: ReactNode; label: string; hint?: string }) {
  return (
    <div>
      <div className="text-3xl font-semibold tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-sm font-medium text-ink">{label}</div>
      {hint ? <div className="text-xs text-faint">{hint}</div> : null}
    </div>
  );
}

const STATUS_STYLES: Record<HealthStatus, { dot: string; pill: string }> = {
  healthy: { dot: "bg-healthy", pill: "bg-healthy/10 text-healthy" },
  "at-risk": { dot: "bg-risk", pill: "bg-risk/10 text-risk" },
  "service-issue": { dot: "bg-service", pill: "bg-service/10 text-service" },
  learning: { dot: "bg-learning", pill: "bg-learning/10 text-learning" },
};

export function HealthDot({ status }: { status: HealthStatus }) {
  return <span className={cx("inline-block h-2 w-2 rounded-full", STATUS_STYLES[status].dot)} />;
}

export function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status].pill,
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", STATUS_STYLES[status].dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "wine" | "gold";
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted border border-line",
    wine: "bg-wine-soft text-wine",
    gold: "bg-gold-soft text-gold",
  } as const;
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-full bg-wine-soft text-xs font-semibold text-wine",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Trend({ pct, className }: { pct: number; className?: string }) {
  const up = pct >= 0;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 text-sm font-semibold tabular-nums",
        up ? "text-healthy" : "text-risk",
        className,
      )}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {signedPct(pct)}
    </span>
  );
}
