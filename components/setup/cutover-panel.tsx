"use client";

import { useState, useTransition } from "react";
import { Card, SectionHeader } from "@/components/ui";
import { resetForFirstSync } from "./cutover-actions";

export function CutoverPanel() {
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const armed = confirm.trim().toUpperCase() === "RESET";

  function run() {
    setResult(null);
    start(async () => {
      const res = await resetForFirstSync(confirm);
      setResult(res);
      if (res.ok) setConfirm("");
    });
  }

  return (
    <Card className="border border-risk/30 bg-risk/5 p-6">
      <SectionHeader
        title="Go-live: switch to live QuickBooks sync"
        intro="One-time step, for when the on-site QuickBooks agent is installed and ready to run its first sync."
      />

      <div className="mt-4 space-y-3 text-sm text-muted">
        <p>
          The dashboard currently shows the data loaded from the uploaded QuickBooks export. The live agent keys
          everything by QuickBooks&rsquo; own ids, which can&rsquo;t be merged with that, so before the first live sync
          this clears the <strong className="text-ink">current customers, products and sales</strong> and lets the
          agent&rsquo;s first full sync reload everything fresh from QuickBooks.
        </p>
        <p>
          Team logins, health thresholds, routes, visits and follow-ups are kept. This can&rsquo;t be undone, but the
          first sync repopulates the data within a minute or two. <strong className="text-ink">Only run this once,
          at go-live.</strong>
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setResult(null);
          }}
          placeholder="Type RESET to confirm"
          className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-risk/30"
        />
        <button
          type="button"
          disabled={!armed || pending}
          onClick={run}
          className="rounded-full bg-risk px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {pending ? "Clearing…" : "Clear data for first sync"}
        </button>
      </div>

      {result ? (
        <div
          className={
            result.ok
              ? "mt-4 rounded-xl border border-healthy/30 bg-healthy/5 p-4 text-sm text-healthy"
              : "mt-4 rounded-xl border border-risk/30 bg-risk/5 p-4 text-sm text-risk"
          }
        >
          {result.message}
        </div>
      ) : null}
    </Card>
  );
}
