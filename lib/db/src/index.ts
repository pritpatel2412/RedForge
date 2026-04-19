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

export const pool = new Pool({ 
  connectionString,
  max: 20,                    // Max connections in pool
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout before returning error
});
export const db = drizzle(pool, { schema });

export { eq } from "drizzle-orm";
export * from "./schema/index.js";
