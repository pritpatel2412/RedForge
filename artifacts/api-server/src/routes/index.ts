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

const router = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/projects", projectsRouter);
router.use("/scans", scansRouter);
router.use("/findings", findingsRouter);
router.use("/keys", keysRouter);
router.use("/workspace", workspaceRouter);
router.use("/dashboard", dashboardRouter);
router.use("/billing", billingRouter);
router.use("/webhooks", webhooksRouter);
router.use("/chat", chatRouter);
router.use("/attack-graph", attackGraphRouter);
router.use("/admin", adminRouter);
router.use("/coupons", couponsRouter);
router.use("/notifications", notificationsRouter);

export default router;
