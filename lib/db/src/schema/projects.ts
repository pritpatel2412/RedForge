import { pgTable, text, timestamp, varchar, uuid, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces.js";

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetUrl: text("target_url").notNull(),
  targetType: varchar("target_type", { length: 50 }).notNull().default("WEB_APP"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  slackWebhookUrl: text("slack_webhook_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const scansTable = pgTable("scans", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull().default("PENDING"),
  scanMode: varchar("scan_mode", { length: 20 }).notNull().default("PASSIVE"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  findingsCount: integer("findings_count").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  lowCount: integer("low_count").notNull().default(0),
  riskScore: real("risk_score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scanLogsTable = pgTable("scan_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id").notNull().references(() => scansTable.id, { onDelete: "cascade" }),
  level: varchar("level", { length: 20 }).notNull().default("INFO"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const findingsTable = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id").notNull().references(() => scansTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  endpoint: text("endpoint").notNull(),
  severity: varchar("severity", { length: 20 }).notNull().default("MEDIUM"),
  status: varchar("status", { length: 50 }).notNull().default("OPEN"),
  cvss: text("cvss"),
  cwe: varchar("cwe", { length: 100 }),
  owasp: varchar("owasp", { length: 100 }),
  pocCode: text("poc_code"),
  fixPatch: text("fix_patch"),
  fixExplanation: text("fix_explanation"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertScanSchema = createInsertSchema(scansTable).omit({ id: true, createdAt: true });
export const insertFindingSchema = createInsertSchema(findingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
export type Scan = typeof scansTable.$inferSelect;
export type ScanLog = typeof scanLogsTable.$inferSelect;
export type Finding = typeof findingsTable.$inferSelect;
