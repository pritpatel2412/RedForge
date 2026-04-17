import { Router } from "express";
import { db, couponsTable, couponUsesTable, workspacesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { sendCouponAppliedEmail } from "../lib/email.js";
import { logActivity } from "../lib/activity.js";
const router = Router();
router.post("/apply", requireAuth, async (req, res) => {
    try {
        const { code } = req.body;
        const user = req.user;
        const workspace = req.workspace;
        if (!code) {
            res.status(400).json({ error: "Coupon code is required" });
            return;
        }
        const [coupon] = await db
            .select()
            .from(couponsTable)
            .where(eq(couponsTable.code, code.toUpperCase().trim()))
            .limit(1);
        if (!coupon || !coupon.isActive) {
            res.status(404).json({ error: "Invalid or inactive coupon code" });
            return;
        }
        const now = new Date();
        if (coupon.validFrom > now) {
            res.status(400).json({ error: "Coupon is not yet active" });
            return;
        }
        if (coupon.validUntil && coupon.validUntil < now) {
            res.status(400).json({ error: "Coupon has expired" });
            return;
        }
        if (coupon.maxUses !== null && coupon.usesCount >= coupon.maxUses) {
            res.status(400).json({ error: "Coupon has reached its usage limit" });
            return;
        }
        // Check if already used
        const [alreadyUsed] = await db
            .select()
            .from(couponUsesTable)
            .where(and(eq(couponUsesTable.couponId, coupon.id), eq(couponUsesTable.workspaceId, workspace.id)))
            .limit(1);
        if (alreadyUsed) {
            res.status(409).json({ error: "You have already used this coupon" });
            return;
        }
        // Apply coupon
        let newPlan = workspace.plan;
        let newTrialEndsAt = workspace.trialEndsAt;
        let benefitText = "";
        if (coupon.type === "plan_grant" && coupon.grantedPlan) {
            newPlan = coupon.grantedPlan;
            newTrialEndsAt = new Date(Date.now() + coupon.durationDays * 24 * 60 * 60 * 1000);
            benefitText = `${coupon.grantedPlan} plan activated for ${coupon.durationDays} days`;
        }
        else if (coupon.type === "trial_extension") {
            const base = newTrialEndsAt && newTrialEndsAt > now ? newTrialEndsAt : now;
            newTrialEndsAt = new Date(base.getTime() + coupon.durationDays * 24 * 60 * 60 * 1000);
            benefitText = `Trial extended by ${coupon.durationDays} days (until ${newTrialEndsAt.toLocaleDateString()})`;
        }
        await db.update(workspacesTable).set({
            plan: newPlan,
            trialEndsAt: newTrialEndsAt,
            updatedAt: now,
        }).where(eq(workspacesTable.id, workspace.id));
        await db.insert(couponUsesTable).values({
            couponId: coupon.id,
            workspaceId: workspace.id,
            userId: user.id,
        });
        await db.update(couponsTable).set({
            usesCount: coupon.usesCount + 1,
            updatedAt: now,
        }).where(eq(couponsTable.id, coupon.id));
        await logActivity({ userId: user.id, workspaceId: workspace.id, action: "coupon.applied", metadata: { code: coupon.code, benefit: benefitText }, req });
        await sendCouponAppliedEmail({ email: user.email, name: user.name }, coupon.code, benefitText);
        res.json({ success: true, benefit: benefitText, newPlan, newTrialEndsAt });
    }
    catch (err) {
        req.log.error(err, "coupon apply error");
        res.status(500).json({ error: "Internal server error" });
    }
});
export default router;
