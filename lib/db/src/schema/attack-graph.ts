import { pgTable, text, timestamp, varchar, uuid, real } from "drizzle-orm/pg-core";
import { scansTable } from "./projects";

export const attackGraphsTable = pgTable("attack_graphs", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id").notNull().references(() => scansTable.id, { onDelete: "cascade" }).unique(),
  status: varchar("status", { length: 50 }).notNull().default("PENDING"),
  graphJson: text("graph_json"),
  chainedRiskLevel: varchar("chained_risk_level", { length: 20 }),
  chainedRiskScore: real("chained_risk_score"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AttackGraph = typeof attackGraphsTable.$inferSelect;
