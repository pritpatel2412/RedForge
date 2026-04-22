import { defineConfig } from "drizzle-kit";
import { normalizeDatabaseUrl } from "./src/normalize-database-url";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: normalizeDatabaseUrl(process.env.DATABASE_URL),
  },
  tablesFilter: ["!pg_stat_statements", "!pg_stat_statements_info"],
});
