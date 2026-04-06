import { Router } from "express";
import { db, workspacesTable as workspacesTableRaw } from "@workspace/db";
const workspacesTable = workspacesTableRaw as any;
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

router.post("/stripe", async (req: Request, res: Response) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-12-18.acacia" as any });

    const sig = req.headers["stripe-signature"] as string;
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      req.log.error(err, "Stripe webhook signature verification failed");
      res.status(400).json({ error: `Webhook Error: ${err.message}` });
      return;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const workspaceId = session.metadata?.workspaceId;
        if (workspaceId) {
          await db.update(workspacesTable).set({
            plan: "PRO",
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            trialEndsAt: null,
          }).where(eq(workspacesTable.id as any, workspaceId));
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as any;
        const customerId = sub.customer;
        const [workspace] = await db.select().from(workspacesTable)
          .where(eq(workspacesTable.stripeCustomerId as any, customerId)).limit(1);
        if (workspace) {
          const plan = sub.status === "active" ? "PRO" : "FREE";
          await db.update(workspacesTable).set({
            plan,
            stripeSubscriptionId: sub.id,
          }).where(eq(workspacesTable.id as any, workspace.id));
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const customerId = sub.customer;
        const [workspace] = await db.select().from(workspacesTable)
          .where(eq(workspacesTable.stripeCustomerId as any, customerId)).limit(1);
        if (workspace) {
          await db.update(workspacesTable).set({
            plan: "FREE",
            stripeSubscriptionId: null,
          }).where(eq(workspacesTable.id as any, workspace.id));
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        req.log.warn({ customerId: invoice.customer }, "Stripe payment failed");
        break;
      }

      default:
        req.log.info({ type: event.type }, "Unhandled Stripe webhook event");
    }

    res.json({ received: true });
  } catch (err) {
    req.log.error(err, "Error processing Stripe webhook");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

