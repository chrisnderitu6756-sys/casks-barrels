// POST /api/sync/start — the on-site agent opens a sync session. It supplies the
// syncId, syncType and watermark (it tracks its own). We just record the open
// session; batches stage against it and nothing is applied until /commit.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { checkSyncAuth } from "@/lib/sync/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const unauth = checkSyncAuth(req);
  if (unauth) return unauth;

  let body: {
    syncId?: string;
    syncType?: string;
    since?: string | null;
    startedAt?: string | null;
    pollSeconds?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { syncId, syncType } = body;
  if (!syncId || (syncType !== "full" && syncType !== "incremental")) {
    return NextResponse.json(
      { error: "Expected { syncId, syncType: 'full'|'incremental', since, startedAt }" },
      { status: 400 },
    );
  }

  const since = body.since ? new Date(body.since) : null;
  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
  const pollSeconds = typeof body.pollSeconds === "number" ? Math.round(body.pollSeconds) : null;

  // Record (or reset) the session. A re-start of the same syncId clears any
  // half-staged batches so the run begins clean.
  await db
    .insert(s.syncSessions)
    .values({ id: syncId, syncType, since, pollSeconds, status: "open", startedAt })
    .onConflictDoUpdate({
      target: s.syncSessions.id,
      set: { syncType, since, pollSeconds, status: "open", startedAt, finishedAt: null, counts: null },
    });

  return NextResponse.json({ ok: true });
}
