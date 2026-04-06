import { db, emailLogsTable } from "@workspace/db";

const BASE_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #050505;
  color: #e4e4e7;
  margin: 0;
  padding: 0;
`;

function emailLayout(content: string, previewText = ""): string {
  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  const logoSrc = appUrl ? `${appUrl}/email-logo.png` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RedForge</title>
${previewText ? `<meta name="description" content="${previewText}">` : ""}
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { ${BASE_STYLES} }
  .wrapper { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .logo-row { text-align: center; margin-bottom: 32px; }
  .logo-img { width: 72px; height: 72px; object-fit: contain; display: inline-block; }
  .logo-text { display: inline-block; font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -0.5px; vertical-align: middle; margin-left: 10px; }
  .card { background: #0d0d0d; border: 1px solid #1f1f1f; border-radius: 12px; padding: 32px; margin-bottom: 24px; }
  h1 { font-size: 24px; font-weight: 700; color: #ffffff; margin-bottom: 12px; letter-spacing: -0.5px; }
  h2 { font-size: 18px; font-weight: 600; color: #ffffff; margin-bottom: 8px; }
  p { font-size: 15px; line-height: 1.6; color: #a1a1aa; margin-bottom: 16px; }
  p:last-child { margin-bottom: 0; }
  .btn { display: inline-block; background: #e11d48; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 16px 0; }
  .divider { border: none; border-top: 1px solid #1f1f1f; margin: 24px 0; }
  .badge { display: inline-block; background: #1a1a2e; border: 1px solid #2d2d5e; color: #818cf8; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
  .badge-warning { background: #1c1008; border-color: #78350f; color: #f59e0b; }
  .badge-danger { background: #1c0808; border-color: #7f1d1d; color: #ef4444; }
  .feature-list { list-style: none; padding: 0; }
  .feature-list li { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #1a1a1a; font-size: 14px; color: #a1a1aa; }
  .feature-list li:last-child { border-bottom: none; }
  .check { color: #34d399; font-size: 16px; }
  .footer { text-align: center; font-size: 12px; color: #52525b; padding-top: 24px; }
  .footer a { color: #71717a; text-decoration: none; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .stat-box { background: #111; border: 1px solid #222; border-radius: 8px; padding: 16px; text-align: center; }
  .stat-value { font-size: 28px; font-weight: 700; color: #fff; }
  .stat-label { font-size: 12px; color: #71717a; margin-top: 4px; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="logo-row">
    ${logoSrc
      ? `<img src="${logoSrc}" alt="RedForge" class="logo-img" />`
      : `<span style="font-size:28px;font-weight:800;color:#e11d48;letter-spacing:-1px;">RedForge</span>`
    }
  </div>
  ${content}
  <div class="footer">
    <p>© ${new Date().getFullYear()} RedForge, Inc. · <a href="#">Unsubscribe</a> · <a href="#">Privacy Policy</a></p>
  </div>
</div>
</body>
</html>`;
}

export function buildWelcomeEmail(name: string, trialEndsAt: Date | null): string {
  const trialDays = trialEndsAt
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000)
    : 14;
  return emailLayout(`
    <div class="card">
      <div class="badge">Welcome to RedForge</div>
      <h1>You're in, ${name.split(" ")[0]}. 🔥</h1>
      <p>Your account is ready. RedForge gives you autonomous AI-driven penetration testing — finding real vulnerabilities before attackers do.</p>
      <a class="btn" href="https://redforge.replit.app/dashboard">Open Dashboard →</a>
      <hr class="divider">
      <h2>Your ${trialDays}-day trial includes:</h2>
      <ul class="feature-list">
        <li><span class="check">✓</span> Unlimited scan targets</li>
        <li><span class="check">✓</span> AI vulnerability analysis (OWASP Top 10 + SANS 25)</li>
        <li><span class="check">✓</span> Attack path chaining & exploit simulation</li>
        <li><span class="check">✓</span> AI Security Chat Assistant</li>
        <li><span class="check">✓</span> One-click fix patches & PDF reports</li>
      </ul>
    </div>
    <p style="text-align:center; font-size:13px; color:#52525b;">Need help? Reply to this email — we read every message.</p>
  `, `Welcome to RedForge — your ${trialDays}-day trial starts now`);
}

export function buildTrialExpiringEmail(name: string, daysLeft: number, trialEndsAt: Date): string {
  const isUrgent = daysLeft <= 1;
  return emailLayout(`
    <div class="card">
      <div class="badge ${isUrgent ? "badge-danger" : "badge-warning"}">${isUrgent ? "⚠️ Trial Ending Today" : `⏳ ${daysLeft} days left`}</div>
      <h1>${isUrgent ? "Last chance, " : "Hey, "}${name.split(" ")[0]}.</h1>
      <p>Your RedForge free trial ${isUrgent ? "ends today" : `expires in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`} on <strong style="color:#e4e4e7">${trialEndsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.</p>
      <p>Upgrade now to keep access to all your scans, findings, and AI-driven security tools.</p>
      <a class="btn" href="https://redforge.replit.app/settings/billing">Upgrade to Pro →</a>
      <hr class="divider">
      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-value" style="color:#e11d48">$79</div>
          <div class="stat-label">per month</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:#34d399">∞</div>
          <div class="stat-label">scans & targets</div>
        </div>
      </div>
    </div>
  `, `Your RedForge trial ${isUrgent ? "ends today" : `expires in ${daysLeft} days`}`);
}

export function buildPlanChangedEmail(name: string, newPlan: string, changedBy = "admin"): string {
  return emailLayout(`
    <div class="card">
      <div class="badge">Plan Updated</div>
      <h1>Your plan has been updated.</h1>
      <p>Hi ${name.split(" ")[0]}, your RedForge workspace plan has been changed to <strong style="color:#818cf8">${newPlan}</strong>${changedBy === "admin" ? " by the RedForge team" : ""}.</p>
      <a class="btn" href="https://redforge.replit.app/dashboard">View Dashboard →</a>
    </div>
  `, `Your RedForge plan has been changed to ${newPlan}`);
}

export function buildCouponAppliedEmail(name: string, couponCode: string, benefit: string): string {
  return emailLayout(`
    <div class="card">
      <div class="badge">Coupon Applied ✓</div>
      <h1>Your coupon is active.</h1>
      <p>Hi ${name.split(" ")[0]}, coupon <strong style="color:#34d399; font-family:monospace">${couponCode}</strong> has been applied to your workspace.</p>
      <p><strong style="color:#e4e4e7">${benefit}</strong></p>
      <a class="btn" href="https://redforge.replit.app/dashboard">Get Started →</a>
    </div>
  `, `Coupon ${couponCode} applied to your RedForge account`);
}

async function logEmail(
  to: string,
  subject: string,
  template: string,
  status: "sent" | "failed",
  error?: string,
  metadata?: Record<string, any>,
) {
  try {
    await db.insert(emailLogsTable).values({
      to,
      subject,
      template,
      status,
      error: error || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      sentAt: status === "sent" ? new Date() : null,
    });
  } catch (e) {
    console.error("[email] failed to log email:", e);
  }
}

// ── Nodemailer transporter (created once, reused) ──────────────────────────
import nodemailer from "nodemailer";

function createTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpSecure = process.env.SMTP_SECURE === "true"; // false for 587/STARTTLS, true for 465/SSL

  if (!smtpUser || !smtpPass) {
    return null; // no credentials — simulation mode
  }

  // Use Gmail service shorthand when host is Gmail — handles TLS/auth correctly
  const isGmail = smtpHost.includes("gmail.com");
  return nodemailer.createTransport({
    ...(isGmail
      ? { service: "gmail" }
      : { host: smtpHost, port: smtpPort, secure: smtpSecure }),
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized: false, // fixes self-signed cert errors in dev/tunnel environments
    },
  });
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  template: string;
  metadata?: Record<string, any>;
}): Promise<boolean> {
  const { to, subject, html, template, metadata } = params;
  const fromName = process.env.SMTP_FROM_NAME || "RedForge";
  const fromEmail = process.env.SMTP_USER || "try.prit24@gmail.com";
  const from = `${fromName} <${fromEmail}>`;

  const transporter = createTransporter();

  if (!transporter) {
    console.log(`[email] No SMTP credentials — would send to ${to}: ${subject}`);
    await logEmail(to, subject, template, "sent", undefined, { ...metadata, simulated: true });
    return true;
  }

  try {
    await transporter.sendMail({ from, to, subject, html });
    await logEmail(to, subject, template, "sent", undefined, metadata);
    console.log(`[email] Sent "${subject}" → ${to}`);
    return true;
  } catch (err: any) {
    console.error("[email] send failed:", err.message);
    await logEmail(to, subject, template, "failed", err.message, metadata);
    return false;
  }
}

export async function sendWelcomeEmail(user: { email: string; name: string }, trialEndsAt: Date | null) {
  await sendEmail({
    to: user.email,
    subject: "Welcome to RedForge — your trial starts now 🔥",
    html: buildWelcomeEmail(user.name, trialEndsAt),
    template: "welcome",
    metadata: { userId: user.email },
  });
}

export async function sendTrialExpiringEmail(user: { email: string; name: string }, daysLeft: number, trialEndsAt: Date) {
  await sendEmail({
    to: user.email,
    subject: daysLeft <= 1
      ? "⚠️ Your RedForge trial ends today"
      : `⏳ ${daysLeft} days left on your RedForge trial`,
    html: buildTrialExpiringEmail(user.name, daysLeft, trialEndsAt),
    template: "trial_expiring",
    metadata: { daysLeft },
  });
}

export async function sendPlanChangedEmail(user: { email: string; name: string }, newPlan: string, changedBy = "admin") {
  await sendEmail({
    to: user.email,
    subject: `Your RedForge plan has been updated to ${newPlan}`,
    html: buildPlanChangedEmail(user.name, newPlan, changedBy),
    template: "plan_changed",
  });
}

export async function sendCouponAppliedEmail(user: { email: string; name: string }, couponCode: string, benefit: string) {
  await sendEmail({
    to: user.email,
    subject: `Coupon ${couponCode} applied to your RedForge account`,
    html: buildCouponAppliedEmail(user.name, couponCode, benefit),
    template: "coupon_applied",
  });
}

export function buildPasswordResetEmail(name: string, resetLink: string): string {
  return emailLayout(`
    <div class="card">
      <div class="badge">Password Reset</div>
      <h1>Reset your password</h1>
      <p>Hi ${name.split(" ")[0]}, we received a request to reset your RedForge account password.</p>
      <p>Click the button below to choose a new password. This link will expire in 1 hour.</p>
      <a class="btn" href="${resetLink}">Reset Password →</a>
      <p style="margin-top:24px; font-size:13px">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `, `Reset your RedForge password`);
}

export async function sendPasswordResetEmail(user: { email: string; name: string }, resetLink: string) {
  await sendEmail({
    to: user.email,
    subject: "Reset your RedForge password",
    html: buildPasswordResetEmail(user.name, resetLink),
    template: "password_reset",
  });
}

