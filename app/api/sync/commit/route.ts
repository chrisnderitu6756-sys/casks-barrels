// POST /api/sync/commit — the agent signals the sync is complete. ONLY NOW do we
// apply the staged batches (upsert + deletions + freshness), atomically. If this
// never arrives, the staged batches are simply never applied and the previous
// good data keeps showing.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { checkSyncAuth } from "@/lib/sync/auth";
import { applyStagedSync } from "@/lib/sync/apply";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const unauth = checkSyncAuth(req);
  if (unauth) return unauth;

  let body: { syncId?: string; finishedAt?: string; counts?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const syncId = body.syncId;
  const finishedAt = body.finishedAt || new Date().toISOString();
  if (!syncId) return NextResponse.json({ error: "Missing syncId" }, { status: 400 });

  const [session] = await db
    .select()
    .from(s.syncSessions)
    .where(eq(s.syncSessions.id, syncId))
    .limit(1);
  if (!session) return NextResponse.json({ error: "Unknown syncId" }, { status: 404 });
  if (session.status === "committed") {
    return NextResponse.json({ ok: true, alreadyCommitted: true });
  }

  try {
    const applied = await applyStagedSync(syncId, finishedAt, body.counts ?? null);
    for (const p of ["/", "/customers", "/products", "/setup"]) revalidatePath(p);
    return NextResponse.json({ ok: true, applied });
  } catch (err) {
    // Transaction rolled back; session stays open so the agent can retry commit.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Apply failed" },
      { status: 500 },
    );
  }
}
