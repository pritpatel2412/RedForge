import { db, usersTable, workspacesTable, workspaceMembersTable, eq } from "@workspace/db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { logger } from "./logger.js";

const ADMIN_EMAIL    = "admin@redforge.com";
const ADMIN_PASSWORD = "adminredforge";
const ADMIN_NAME     = "RedForge Admin";

export async function seedAdminAccount(retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const [existing] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, ADMIN_EMAIL))
        .limit(1);

      if (existing) {
        logger.info("Admin account already exists — skipping seed");
        return;
      }

      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

      const [workspace] = await db
        .insert(workspacesTable)
        .values({
          name: "Admin Workspace",
          slug: "admin-redforge-" + Date.now().toString(36),
          plan: "ENTERPRISE",
          trialEndsAt: new Date("2099-01-01"),
        })
        .returning();

      const [user] = await db
        .insert(usersTable)
        .values({
          email: ADMIN_EMAIL,
          passwordHash,
          name: ADMIN_NAME,
          role: "admin",
          provider: "email",
          currentWorkspaceId: workspace.id,
        })
        .returning();

      await db.insert(workspaceMembersTable).values({
        workspaceId: workspace.id,
        userId: user.id,
        role: "owner",
      });

      logger.info({ email: ADMIN_EMAIL }, "Admin account created by seed");
      return; // Success
    } catch (err) {
      const isLast = i === retries - 1;
      const isConnError = 
        err instanceof Error && 
        (err.message.includes("Connection terminated") || err.message.includes("timeout"));

      if (isConnError && !isLast) {
        logger.warn({ attempt: i + 1, delay }, "Database connection failed during seed, retrying...");
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }

      logger.error({ err }, "Failed to seed admin account");
      break; 
    }
  }
}
