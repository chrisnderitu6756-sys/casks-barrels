// One-time (re-runnable) loader: resets the database and loads Casks & Barrels'
// REAL data, parsed from James's QuickBooks exports by scripts/export_real.py.
//
// Run locally only (never in the Vercel build) — it reads JSON from a local
// folder OUTSIDE the repo, so no client data is ever committed:
//
//   DATABASE_URL='postgres://…' npx tsx scripts/load-real.ts
//
// CB_DATA overrides the JSON folder (default: Downloads/cb-client-data/load).

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import bcrypt from "bcryptjs";
import * as s from "../lib/db/schema";

const DATA = process.env.CB_DATA ?? "C:/Users/admin/Downloads/cb-client-data/load";
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const read = (f: string) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));

async function chunkInsert(db: any, table: any, rows: any[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    if (rows.length) await db.insert(table).values(rows.slice(i, i + size));
  }
}

async function main() {
  const sql = postgres(url!, { max: 1 });
  console.log("[load] Resetting schema (DROP SCHEMA public CASCADE)…");
  await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const db = drizzle(sql, { schema: s });
  console.log("[load] Applying migrations…");
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });

  const reps = read("reps.json");
  const products = read("products.json");
  const accounts = read("accounts.json");
  const orders = read("orders.json");

  const PASSWORD = process.env.DEMO_PASSWORD ?? "casks1234";
  const hash = await bcrypt.hash(PASSWORD, 10);

  console.log(`[load] reps (${reps.length})…`);
  await chunkInsert(
    db,
    s.reps,
    reps.map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email ?? null,
      passwordHash: r.login ? hash : null,
      role: r.role,
    })),
  );

  console.log(`[load] products (${products.length})…`);
  await chunkInsert(
    db,
    s.products,
    products.map((p: any) => ({
      id: p.id,
      name: p.name,
      supplier: p.supplier || "",
      unitPriceNet: p.unitPriceNet ?? 0,
    })),
  );

  console.log(`[load] accounts (${accounts.length})…`);
  await chunkInsert(
    db,
    s.accounts,
    accounts.map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.type || "Uncategorised",
      area: a.area ?? null,
      route: a.route ?? null,
      ownerId: a.ownerId || null,
      parentId: a.parentId ?? null,
      cycleDays: a.cycleDays ?? 30,
      knownServiceIssue: !!a.knownServiceIssue,
    })),
  );

  console.log(`[load] orders (${orders.length})…`);
  await chunkInsert(
    db,
    s.orders,
    orders.map((o: any) => ({
      id: o.id,
      number: o.number,
      accountId: o.accountId,
      date: new Date(o.date),
      docType: o.docType,
    })),
    800,
  );

  const lines = orders.flatMap((o: any) =>
    o.lines.map((l: any, i: number) => ({
      id: `${o.id}-l${i + 1}`,
      orderId: o.id,
      productId: l.productId,
      quantity: l.quantity,
      netAmount: l.netAmount,
    })),
  );
  console.log(`[load] order lines (${lines.length})…`);
  await chunkInsert(db, s.orderLines, lines, 800);

  await db.insert(s.thresholds).values({
    id: 1,
    stoppedDays: 35,
    changedCycleMultiplier: 1.5,
    reducedDropPct: 0.3,
    minOrdersToAssess: 3,
  });

  const latest = orders.reduce((m: string, o: any) => (o.date > m ? o.date : m), orders[0].date);
  await db.insert(s.importRuns).values({
    id: "initial-real",
    at: new Date(`${latest}T18:00:00+03:00`),
    status: "success",
    ordersImported: orders.length,
    source: "QuickBooks Sales by Item Detail (Jan–Nov 2026)",
    message: "Initial real-data load",
  });

  console.log(
    "[load] DONE:",
    JSON.stringify({
      reps: reps.length,
      products: products.length,
      accounts: accounts.length,
      orders: orders.length,
      lines: lines.length,
    }),
  );
  await sql.end();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[load] FAILED:", e);
    process.exit(1);
  });
