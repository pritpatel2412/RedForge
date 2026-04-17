import { pgTable, text, timestamp, varchar, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";
import { workspacesTable } from "./workspaces.js";

export const userActivityLogsTable = pgTable("user_activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  workspaceId: uuid("workspace_id").references(() => workspacesTable.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  metadata: text("metadata"),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailLogsTable = pgTable("email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  to: varchar("to", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  template: varchar("template", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  error: text("error"),
  metadata: text("metadata"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UserActivityLog = typeof userActivityLogsTable.$inferSelect;
export type EmailLog = typeof emailLogsTable.$inferSelect;
