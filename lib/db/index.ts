import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// postgres.js is lazy — it won't connect until the first query, so constructing
// the client at import time is safe even during the build (no DATABASE_URL needed
// until a request actually hits the database).
const connectionString = process.env.DATABASE_URL ?? "postgresql://placeholder";

const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> };
const client = globalForDb._pg ?? postgres(connectionString, { prepare: false, max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb._pg = client;

export const db = drizzle(client, { schema });
export { schema };
