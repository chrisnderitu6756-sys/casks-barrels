// POST /api/sync/batch — the agent sends one page of records for an entity.
// Batches arrive many times, in any order; we STAGE them keyed by
// (syncId, entity, seq) so a retry/resend overwrites and never duplicates.
// Nothing is applied until /commit.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { checkSyncAuth } from "@/lib/sync/auth";

export const dynamic = "force-dynamic";

const ENTITIES = new Set(["customers", "items", "transactions", "deletions"]);

export async function POST(req: Request) {
  const unauth = checkSyncAuth(req);
  if (unauth) return unauth;

  let body: { syncId?: string; entity?: string; seq?: number; records?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { syncId, entity, seq, records } = body;
  if (!syncId || !entity || !ENTITIES.has(entity) || typeof seq !== "number" || !Array.isArray(records)) {
    return NextResponse.json(
      { error: "Expected { syncId, entity: customers|items|transactions|deletions, seq, records[] }" },
      { status: 400 },
    );
  }

  const [session] = await db
    .select()
    .from(s.syncSessions)
    .where(eq(s.syncSessions.id, syncId))
    .limit(1);
  if (!session) {
    return NextResponse.json({ error: "Unknown syncId" }, { status: 404 });
  }
  if (session.status !== "open") {
    return NextResponse.json({ error: `Sync is ${session.status}, not open` }, { status: 409 });
  }

  // Stage, overwriting any prior page with the same (syncId, entity, seq).
  await db
    .insert(s.syncBatches)
    .values({ syncId, entity, seq, records })
    .onConflictDoUpdate({
      target: [s.syncBatches.syncId, s.syncBatches.entity, s.syncBatches.seq],
      set: { records, receivedAt: new Date() },
    });

  return NextResponse.json({ ok: true, entity, seq, staged: records.length });
}
