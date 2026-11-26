// Runs at build time (before `next build`): applies migrations, then seeds the
// sample data once. Skips cleanly if DATABASE_URL isn't set yet, so a build
// never fails just because the database variable hasn't been added.

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./index";
import { seedDatabase } from "./seed";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("[db:setup] DATABASE_URL not set — skipping migrate + seed.");
    return;
  }
  console.log("[db:setup] Applying migrations…");
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  console.log("[db:setup] Seeding (first run only)…");
  const result = await seedDatabase();
  console.log("[db:setup] Done:", JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[db:setup] Failed:", err);
    process.exit(1);
  });
