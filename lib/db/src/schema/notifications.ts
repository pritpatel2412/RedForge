import { pgTable, text, timestamp, varchar, uuid, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";
import { workspacesTable } from "./workspaces.js";

export const notificationsTable = pgTable("notifications", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").references(() => workspacesTable.id, { onDelete: "cascade" }),
  type:        varchar("type", { length: 50 }).notNull().default("info"),   // info | success | warning | error
  title:       varchar("title", { length: 255 }).notNull(),
  body:        text("body").notNull(),
  link:        text("link"),                                                  // optional in-app href
  read:        boolean("read").notNull().default(false),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
