import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";
import { normalizeDatabaseUrl } from "./normalize-database-url.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export { eq } from "drizzle-orm";
export * from "./schema/index.js";
