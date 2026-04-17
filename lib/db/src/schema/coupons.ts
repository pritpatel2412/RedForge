import { pgTable, text, timestamp, varchar, uuid, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";
import { workspacesTable } from "./workspaces.js";

export const couponsTable = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: text("description"),
  type: varchar("type", { length: 30 }).notNull().default("trial_extension"),
  grantedPlan: varchar("granted_plan", { length: 50 }),
  durationDays: integer("duration_days").notNull().default(30),
  discountPercent: integer("discount_percent"),
  maxUses: integer("max_uses"),
  usesCount: integer("uses_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  validFrom: timestamp("valid_from").notNull().defaultNow(),
  validUntil: timestamp("valid_until"),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const couponUsesTable = pgTable("coupon_uses", {
  id: uuid("id").primaryKey().defaultRandom(),
  couponId: uuid("coupon_id").notNull().references(() => couponsTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  usedAt: timestamp("used_at").notNull().defaultNow(),
});

export type Coupon = typeof couponsTable.$inferSelect;
export type CouponUse = typeof couponUsesTable.$inferSelect;
