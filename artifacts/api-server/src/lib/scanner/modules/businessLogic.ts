import type { ScanContext, FindingInput } from "./types.js";

const SEQUENTIAL_ID_PATTERN = /["'](\/api\/[a-z\-]+\/(\d+|:[a-z]+id))["']/gi;
const EMAIL_DOMAIN_GATING = /\.edu|\.gov|\.ac\.|\.edu\.|university|college|school/i;

export async function runBusinessLogicModule(ctx: ScanContext): Promise<FindingInput[]> {
  const findings: FindingInput[] = [];
  const { targetUrl, bodyText, reachable, addLog } = ctx;

  await addLog("INFO", "[Module 4] Business logic vulnerability detector — IDOR, pricing, email gating...");

  if (!reachable || !bodyText) {
    await addLog("WARN", "[Module 4] Target unreachable — skipping business logic analysis");
    return findings;
  }

  // 1. Stripe + pricing plan enforcement
  const hasStripe = /stripe\.com\/v3|stripe\.js|pk_live_|pk_test_|pk_/i.test(bodyText);
  const hasPricingPage = /pricing|plan|subscribe|checkout|upgrade|premium|pro\s+plan|business\s+plan/i.test(bodyText);

  if (hasStripe && hasPricingPage) {
    await addLog("WARN", "Stripe integration + pricing page detected — checking for client-side price ID exposure");
    const priceIdInClient = /price_[0-9a-zA-Z_]{10,}|prod_[0-9a-zA-Z]{10,}/i.test(bodyText);

    if (priceIdInClient) {
      await addLog("WARN", "Stripe Price/Product IDs found in client-side HTML — verify server creates sessions with hardcoded IDs");
      findings.push({
        title: "Stripe Price IDs exposed client-side — verify server enforces pricing",
        description: `Stripe price/product IDs were found in client-side HTML/JS at ${targetUrl}. If checkout sessions are created by passing client-supplied price_IDs to Stripe, users can substitute a lower-tier price ID to purchase premium plans at lower prices. The server must hardcode price IDs based on the selected plan name, never trust client-provided price IDs.`,
        endpoint: targetUrl,
        severity: "HIGH",
        cvss: "6.5",
        cwe: "CWE-602",
        owasp: "A04",
        pocCode: `# Test price ID manipulation:\n# 1. Find price IDs in page source\n# 2. Intercept checkout POST request\n# 3. Replace price_id with a free/cheaper plan ID\n# 4. Complete checkout and verify if premium access is granted`,
        fixPatch: `// ❌ Vulnerable — trusting client price ID:\napp.post('/create-checkout', async (req, res) => {\n  const session = await stripe.checkout.sessions.create({\n    line_items: [{ price: req.body.priceId, quantity: 1 }], // NEVER DO THIS\n  });\n});\n\n// ✅ Fixed — server maps plan name to hardcoded price ID:\nconst PLAN_PRICES = {\n  pro: 'price_1234567890_hardcoded',\n  enterprise: 'price_9876543210_hardcoded',\n};\napp.post('/create-checkout', async (req, res) => {\n  const priceId = PLAN_PRICES[req.body.plan]; // map from plan name\n  if (!priceId) return res.status(400).json({ error: 'Invalid plan' });\n  const session = await stripe.checkout.sessions.create({\n    line_items: [{ price: priceId, quantity: 1 }],\n  });\n});`,
        fixExplanation: "Never accept Stripe price IDs from the client. Server-side code should maintain a hardcoded map of plan names to price IDs. Create Stripe checkout sessions entirely server-side using the hardcoded IDs.",
      });
    } else {
      await addLog("DEBUG", "Stripe detected — no price IDs found client-side (good practice)");
      findings.push({
        title: "Stripe integration detected — verify server-side plan enforcement",
        description: `Stripe payment integration is present on ${targetUrl}. Verify that: 1) Checkout sessions are created server-side with hardcoded price IDs, 2) Webhook events (not client callbacks) confirm subscription activation, 3) Plan limits are enforced via server-side checks against the user's active Stripe subscription status.`,
        endpoint: targetUrl,
        severity: "MEDIUM",
        cvss: "5.5",
        cwe: "CWE-602",
        owasp: "A04",
        fixExplanation: "Audit your Stripe integration: verify that plan enforcement uses Stripe webhooks to sync subscription status to your database, and that all feature gates check the database subscription status server-side.",
      });
    }
  }

  // 2. Email domain gating bypass risk
  const hasEmailGating = EMAIL_DOMAIN_GATING.test(bodyText);
  const hasPlanGating = /student|academic|education|institutional|\.edu|gov(?:ernment)?/i.test(bodyText);

  if (hasEmailGating && hasPlanGating) {
    await addLog("WARN", "Email domain-based plan gating detected — flagging bypass risk");
    findings.push({
      title: "Email domain-based plan gating likely bypassable",
      description: `The application appears to gate certain plans by email domain (.edu, .gov, .ac., etc.) at ${targetUrl}. Email domain gating via regex is trivially bypassable — anyone can create an email address at a permissive subdomain or use a catch-all domain that matches the pattern.`,
      endpoint: targetUrl,
      severity: "HIGH",
      cvss: "6.5",
      cwe: "CWE-290",
      owasp: "A04",
      pocCode: `# Bypass examples:\n# 1. Register foo@anything.edu.attacker.com (if regex only checks .includes('.edu'))\n# 2. Use a disposable .edu email service\n# 3. Create any@edu.attacker.com if regex is /\\.edu/i`,
      fixPatch: `// ❌ Vulnerable — regex domain check:\nif (email.includes('.edu')) grantStudentPlan(); // bypassable\n\n// ✅ Fixed — verify against institutional allowlist:\nconst ALLOWED_EDU_DOMAINS = ['mit.edu', 'stanford.edu', ...];\nconst emailDomain = email.split('@')[1];\nif (ALLOWED_EDU_DOMAINS.includes(emailDomain)) grantStudentPlan();\n// Or: verify via SMTP or send confirmation to institutional email`,
      fixExplanation: "Replace regex-based domain checks with an explicit allowlist of verified institutional domains. Additionally, require email verification to confirm the user actually controls the address. Consider partnering with institutional identity providers (SSO) for stronger verification.",
    });
  }

  // 3. Free tier limit enforcement
  const hasFreeTierDisplay = /free\s+(?:tier|plan|trial)|(?:1|one)\s+(?:project|scan|workspace|seat)\s+free|limited\s+to\s+\d+/i.test(bodyText);
  if (hasFreeTierDisplay) {
    await addLog("DEBUG", "Free tier limits displayed client-side — flagging for server-side enforcement review");
    findings.push({
      title: "Client-displayed plan limits require server-side enforcement verification",
      description: `Plan limits are displayed in the frontend at ${targetUrl} (e.g., "1 scan free", "limited to X projects"). Client-side displayed limits are not security controls — they must also be enforced on every API endpoint server-side. A user bypassing the UI (via direct API calls) should receive the same restrictions.`,
      endpoint: targetUrl,
      severity: "MEDIUM",
      cvss: "5.3",
      cwe: "CWE-602",
      owasp: "A04",
      fixExplanation: "Verify that every API endpoint checks plan limits server-side by querying the user's subscription status from the database. Never rely on frontend code to enforce limits — it can always be bypassed with direct HTTP requests.",
    });
  }

  // 4. IDOR via sequential IDs in JS bundles
  const scriptSrcPattern = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const scriptUrls: string[] = [];
  let match;
  while ((match = scriptSrcPattern.exec(bodyText)) !== null) {
    const src = match[1];
    if (!src.includes("cdn") && !src.includes("unpkg")) {
      try { scriptUrls.push(new URL(src, targetUrl).toString()); } catch { /* ignore */ }
    }
  }

  for (const scriptUrl of scriptUrls.slice(0, 4)) {
    try {
      const res = await fetch(scriptUrl, {
        signal: AbortSignal.timeout(7000),
        headers: { "User-Agent": "RedForge-Scanner/2.1" },
      });
      if (!res.ok) continue;

      const jsBody = await res.text();
      const idPatternCopy = new RegExp(SEQUENTIAL_ID_PATTERN.source, "gi");
      const idMatches: string[] = [];
      let idMatch;
      while ((idMatch = idPatternCopy.exec(jsBody)) !== null) {
        idMatches.push(idMatch[1]);
      }

      if (idMatches.length > 0) {
        const uniquePaths = [...new Set(idMatches)].slice(0, 5);
        await addLog("WARN", `Sequential/numeric ID API paths found: ${uniquePaths.join(", ")}`);
        findings.push({
          title: "Sequential/numeric IDs in API paths — potential IDOR risk",
          description: `API endpoints with sequential or numeric IDs were found in JavaScript at ${scriptUrl}: ${uniquePaths.join(", ")}. Sequential IDs make it trivial to enumerate resources. If ownership checks are absent, any authenticated user can access other users' data by incrementing the ID (Insecure Direct Object Reference).`,
          endpoint: scriptUrl,
          severity: "MEDIUM",
          cvss: "5.4",
          cwe: "CWE-639",
          owasp: "A01",
          pocCode: `# IDOR test — replace ID with adjacent values:\ncurl -H "Authorization: Bearer <your-token>" \\\n  "${targetUrl}/api/resource/1"\n  "${targetUrl}/api/resource/2"\n  "${targetUrl}/api/resource/3"\n# Check if you can access other users' resources`,
          fixPatch: `// ❌ Vulnerable — numeric ID, no ownership check:\napp.get('/api/orders/:id', async (req, res) => {\n  const order = await Order.findById(req.params.id); // IDOR!\n  res.json(order);\n});\n\n// ✅ Fixed — UUID + ownership verification:\napp.get('/api/orders/:id', requireAuth, async (req, res) => {\n  const order = await Order.findOne({\n    id: req.params.id,\n    userId: req.user.id // Always scope to authenticated user\n  });\n  if (!order) return res.status(404).json({ error: 'Not found' });\n  res.json(order);\n});`,
          fixExplanation: "Switch from sequential integers to UUIDs (harder to guess). More importantly, always verify resource ownership server-side: every query should include a WHERE userId = authenticatedUserId clause. Implement centralized authorization middleware.",
        });
        break;
      }
    } catch { /* ignore */ }
  }

  await addLog("DEBUG", `[Module 4] Business logic complete — ${findings.length} issue(s) found`);
  return findings;
}
