import { Router } from "express";
import { db, workspacesTable, projectsTable, scansTable, findingsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { sendTestMessage } from "../lib/notifications/slack.js";
import { isAtLeastPlan } from "../lib/plan.js";

const router = Router();

router.get("/settings", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
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
  } catch (err) {
    req.log.error(err, "Error getting workspace settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/settings", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const { name, slackWebhookUrl } = req.body;

    if (slackWebhookUrl !== undefined && !isAtLeastPlan(workspace.plan, "PRO")) {
      res.status(403).json({ error: "Upgrade to PRO to use Slack notifications" });
      return;
    }

    const [updated] = (await db.update(workspacesTable).set({
      name: name || workspace.name,
      slackWebhookUrl: slackWebhookUrl !== undefined ? slackWebhookUrl : workspace.slackWebhookUrl,
      updatedAt: new Date(),
    }).where(eq(workspacesTable.id as any, workspace.id)).returning()) as any;

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
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/test-slack", requireAuth, async (req, res) => {
  try {
    const { slackWebhookUrl } = req.body;
    const workspace = (req as any).workspace;
    if (!isAtLeastPlan(workspace.plan, "PRO")) {
      res.status(403).json({ error: "Upgrade to PRO to use Slack notifications" });
      return;
    }
    if (!slackWebhookUrl) {
      res.status(400).json({ error: "slackWebhookUrl is required" });
      return;
    }

    if (!slackWebhookUrl.startsWith("https://hooks.slack.com/")) {
      res.status(400).json({ error: "Invalid Slack Webhook URL — must start with https://hooks.slack.com/" });
      return;
    }

    await sendTestMessage(slackWebhookUrl);
    res.json({ message: "Test message sent" });
  } catch (err) {
    req.log.error(err, "Error testing Slack webhook");
    res.status(500).json({ error: "Failed to send test message. Check your URL and try again." });
  }
});

export default router;


