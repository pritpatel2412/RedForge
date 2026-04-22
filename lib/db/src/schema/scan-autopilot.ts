import { pgTable, uuid, varchar, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { projectsTable, scansTable } from "./projects";

export const scanAutopilotTable = pgTable("scan_autopilot", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().unique().references(() => projectsTable.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  frequency: varchar("frequency", { length: 20 }).notNull().default("DAILY"), // DAILY | WEEKLY
  onDeploy: boolean("on_deploy").notNull().default(false),
  scanMode: varchar("scan_mode", { length: 20 }).notNull().default("PASSIVE"), // PASSIVE | ACTIVE
  dayOfWeek: integer("day_of_week").notNull().default(1), // 0-6, used for WEEKLY
  hourUtc: integer("hour_utc").notNull().default(2), // 0-23
  nextRunAt: timestamp("next_run_at").notNull().defaultNow(),
  lastRunAt: timestamp("last_run_at"),
  lastScanId: uuid("last_scan_id").references(() => scansTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ScanAutopilot = typeof scanAutopilotTable.$inferSelect;
