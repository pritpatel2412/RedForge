import { Router } from "express";
import { db, workspacesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
const router = Router();
router.get("/settings", requireAuth, async (req, res) => {
    try {
        const workspace = req.workspace;
        res.json({
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            plan: workspace.plan,
            slackWebhookUrl: workspace.slackWebhookUrl,
            stripeCustomerId: workspace.stripeCustomerId,
            stripeSubscriptionId: workspace.stripeSubscriptionId,
            trialEndsAt: workspace.trialEndsAt,
            createdAt: workspace.createdAt,
        });
    }
    catch (err) {
        req.log.error(err, "Error getting workspace settings");
        res.status(500).json({ error: "Internal server error" });
    }
});
router.patch("/settings", requireAuth, async (req, res) => {
    try {
        const workspace = req.workspace;
        const { name, slackWebhookUrl } = req.body;
        const [updated] = (await db.update(workspacesTable).set({
            name: name || workspace.name,
            slackWebhookUrl: slackWebhookUrl !== undefined ? slackWebhookUrl : workspace.slackWebhookUrl,
            updatedAt: new Date(),
        }).where(eq(workspacesTable.id, workspace.id)).returning());
        res.json({
            id: updated.id,
            name: updated.name,
            slug: updated.slug,
            plan: updated.plan,
            slackWebhookUrl: updated.slackWebhookUrl,
            stripeCustomerId: updated.stripeCustomerId,
            stripeSubscriptionId: updated.stripeSubscriptionId,
            trialEndsAt: updated.trialEndsAt,
            createdAt: updated.createdAt,
        });
    }
    catch (err) {
        req.log.error(err, "Error updating workspace settings");
        res.status(500).json({ error: "Internal server error" });
    }
});
export default router;
