"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Freshness / heartbeat indicator. For a live QuickBooks sync, the agent commits
 * every poll (even with no changes), so the "last update" time advancing IS the
 * liveness signal. We auto-tune the staleness window to the agent's cadence
 * (amber ≈ 3× pollSeconds, red ≈ 10×) and, while a sync is live, refresh the page
 * on that cadence so new data appears without a manual reload.
 */
export function LiveStatus({
  at,
  pollSeconds,
}: {
  at: string;
  pollSeconds: number | null;
  source?: string | null;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!pollSeconds) return;
    const ms = Math.max(pollSeconds, 30) * 1000;
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [pollSeconds, router]);

  const ageSec = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000));
  const ago =
    ageSec < 45
      ? "just now"
      : ageSec < 3600
        ? `${Math.round(ageSec / 60)} min ago`
        : ageSec < 86_400
          ? `${Math.round(ageSec / 3600)}h ago`
          : `${Math.round(ageSec / 86_400)}d ago`;

  // No live sync (manual .xlsx import / initial load): neutral "updated" note.
  if (!pollSeconds) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <span className="h-2 w-2 rounded-full bg-faint" />
        Updated {ago}
      </span>
    );
  }

  const level = ageSec < pollSeconds * 3 ? "live" : ageSec < pollSeconds * 10 ? "warn" : "stale";
  const cfg = {
    live: { dot: "bg-healthy", text: "text-healthy" },
    warn: { dot: "bg-gold", text: "text-gold" },
    stale: { dot: "bg-risk", text: "text-risk" },
  }[level];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}
      title={`Live QuickBooks sync · agent polls every ${pollSeconds}s · last update ${ago}`}
    >
      <span className={`h-2 w-2 rounded-full ${cfg.dot} ${level === "live" ? "animate-pulse" : ""}`} />
      {level === "live" ? (
        <>
          Live <span className="font-normal text-faint">· {ago}</span>
        </>
      ) : level === "warn" ? (
        `Last update ${ago}`
      ) : (
        `Stale — no update ${ago}`
      )}
    </span>
  );
}
