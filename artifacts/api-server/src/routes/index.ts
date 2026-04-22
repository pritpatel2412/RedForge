import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import projectsRouter from "./projects.js";
import scansRouter from "./scans.js";
import findingsRouter from "./findings.js";
import keysRouter from "./keys.js";
import workspaceRouter from "./workspace.js";
import dashboardRouter from "./dashboard.js";
import billingRouter from "./billing.js";
import webhooksRouter from "./webhooks.js";
import chatRouter from "./chat.js";
import attackGraphRouter from "./attack-graph.js";
import adminRouter from "./admin.js";
import couponsRouter from "./coupons.js";
import notificationsRouter from "./notifications.js";
import ciRouter from "./ci.js";
import { requireActiveSubscription } from "../lib/auth.js";

const router = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/billing", billingRouter);
router.use("/webhooks", webhooksRouter);
router.use("/admin", adminRouter);

// Functional routes requiring active trial or paid plan
router.use("/projects", requireActiveSubscription, projectsRouter);
router.use("/scans", requireActiveSubscription, scansRouter);
router.use("/findings", requireActiveSubscription, findingsRouter);
router.use("/keys", requireActiveSubscription, keysRouter);
router.use("/workspace", requireActiveSubscription, workspaceRouter);
router.use("/dashboard", requireActiveSubscription, dashboardRouter);
router.use("/chat", requireActiveSubscription, chatRouter);
router.use("/attack-graph", requireActiveSubscription, attackGraphRouter);
router.use("/coupons", requireActiveSubscription, couponsRouter);
router.use("/notifications", requireActiveSubscription, notificationsRouter);
router.use("/ci", requireActiveSubscription, ciRouter);

export default router;
