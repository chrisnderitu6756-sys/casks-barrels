// Bearer-token auth for the QuickBooks sync endpoints. The on-site agent sends
// `Authorization: Bearer <token>`; we compare it (constant-time) against the
// SYNC_TOKEN env secret. Returns a Response to short-circuit on failure, or null
// when the request is authorized.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function checkSyncAuth(req: Request): NextResponse | null {
  const expected = process.env.CB_SYNC_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "Sync is not configured (CB_SYNC_TOKEN unset)." },
      { status: 503 },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !safeEqual(token, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
