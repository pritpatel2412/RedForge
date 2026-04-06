import { Router } from "express";
import { db, workspacesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.post("/create-checkout", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const { plan } = req.body;

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
    const appUrl = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

    if (!stripeKey || !proPriceId) {
      res.status(503).json({ error: "Billing is not configured" });
      return;
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);

    let customerId = workspace.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { workspaceId: workspace.id },
      });
      customerId = customer.id;
      await db.update(workspacesTable).set({
        stripeCustomerId: customerId,
        updatedAt: new Date(),
      }).where(eq(workspacesTable.id, workspace.id));
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: proPriceId, quantity: 1 }],
      trial_period_days: 14,
      success_url: `${appUrl}/settings/billing?success=1`,
      cancel_url: `${appUrl}/settings/billing?canceled=1`,
      metadata: { workspaceId: workspace.id },
    });

    res.json({ url: session.url });
  } catch (err) {
    req.log.error(err, "Error creating checkout session");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/portal", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const appUrl = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

    if (!workspace.stripeCustomerId) {
      res.status(400).json({ error: "No billing account found" });
      return;
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(503).json({ error: "Billing is not configured" });
      return;
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);

    const session = await stripe.billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url: `${appUrl}/settings/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    req.log.error(err, "Error creating billing portal session");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/webhook", async (req, res) => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeKey || !webhookSecret) {
      res.status(503).json({ error: "Billing not configured" });
      return;
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);

    const sig = req.headers["stripe-signature"] as string;
    let event: any;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      res.status(400).json({ error: "Invalid webhook signature" });
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const workspaceId = session.metadata?.workspaceId;
      if (workspaceId) {
        await db.update(workspacesTable).set({
          stripeSubscriptionId: session.subscription,
          plan: "PRO",
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        }).where(eq(workspacesTable.id, workspaceId));
      }
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const workspaces = await db.select().from(workspacesTable)
        .where(eq(workspacesTable.stripeSubscriptionId, subscription.id));
      for (const ws of workspaces) {
        await db.update(workspacesTable).set({
          plan: "FREE",
          stripeSubscriptionId: null,
          updatedAt: new Date(),
        }).where(eq(workspacesTable.id, ws.id));
      }
    }

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
