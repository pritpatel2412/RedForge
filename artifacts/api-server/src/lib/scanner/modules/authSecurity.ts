import type { ScanContext, FindingInput } from "./types.js";

const AUTH_PATHS = ["/login", "/signin", "/auth/login", "/auth/signin", "/auth/signup", "/register", "/account/login", "/user/login", "/session/new"];

async function safeFetch(url: string, opts?: RequestInit): Promise<{ status: number; body: string; headers: Record<string, string> } | null> {
  try {
    const res = await fetch(url, {
      ...opts,
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "RedForge-Scanner/2.1 Security-Assessment (+https://redforge.io)",
        ...(opts?.headers || {}),
      },
    });
    let body = "";
    try { body = await res.text(); } catch { body = ""; }
    const headers = Object.fromEntries(res.headers.entries());
    return { status: res.status, body, headers };
  } catch {
    return null;
  }
}

export async function runAuthSecurityModule(ctx: ScanContext): Promise<FindingInput[]> {
  const findings: FindingInput[] = [];
  const { targetUrl, bodyText, reachable, addLog } = ctx;

  await addLog("INFO", "[Module 3] Authentication security scanner — login forms, CSRF, CAPTCHA...");

  if (!reachable) {
    await addLog("WARN", "[Module 3] Target unreachable — skipping auth analysis");
    return findings;
  }

  // Detect auth pages
  const authPages: { url: string; body: string }[] = [];

  // Check if main page is an auth page
  if (bodyText && (bodyText.includes("password") || bodyText.includes("login") || bodyText.includes("signin"))) {
    authPages.push({ url: targetUrl, body: bodyText });
  }

  // Probe known auth paths
  for (const path of AUTH_PATHS.slice(0, 5)) {
    let authUrl: string;
    try { authUrl = new URL(path, targetUrl).toString(); } catch { continue; }

    const result = await safeFetch(authUrl);
    if (!result || result.status !== 200) continue;

    const lowerBody = result.body.toLowerCase();
    if (lowerBody.includes("password") && (lowerBody.includes("login") || lowerBody.includes("email") || lowerBody.includes("username"))) {
      authPages.push({ url: authUrl, body: result.body });
      await addLog("DEBUG", `Auth page found: ${path}`);
    }
  }

  if (authPages.length === 0) {
    await addLog("DEBUG", "[Module 3] No auth pages detected");
    return findings;
  }

  await addLog("DEBUG", `Analyzing ${authPages.length} auth page(s) for security issues`);

  for (const { url: authUrl, body } of authPages.slice(0, 3)) {
    const lowerBody = body.toLowerCase();

    // 1. CAPTCHA detection
    const hasCaptcha = lowerBody.includes("recaptcha") || lowerBody.includes("hcaptcha") ||
      lowerBody.includes("turnstile") || lowerBody.includes("captcha") || lowerBody.includes("g-recaptcha");
    if (!hasCaptcha && lowerBody.includes("password")) {
      await addLog("WARN", `No CAPTCHA detected on auth page: ${authUrl}`);
      findings.push({
        title: "No CAPTCHA protection on login page (brute-force risk)",
        description: `The login page at ${authUrl} does not appear to use CAPTCHA (reCAPTCHA, hCaptcha, or Cloudflare Turnstile). Without CAPTCHA, automated credential stuffing and brute-force attacks can run unchallenged.`,
        endpoint: authUrl,
        severity: "MEDIUM",
        cvss: "5.3",
        cwe: "CWE-307",
        owasp: "A07",
        tags: ["captcha", "no-captcha", "brute-force", "auth"],
        pocCode: `# Automated credential stuffing — no CAPTCHA blocking:\nfor cred in admin:password root:root admin:admin123; do\n  curl -X POST ${authUrl} -d "email=$(echo $cred | cut -d: -f1)&password=$(echo $cred | cut -d: -f2)"\ndone`,
        fixExplanation: "Add CAPTCHA to your login form. Use Cloudflare Turnstile (privacy-friendly), Google reCAPTCHA v3 (invisible), or hCaptcha. Combine with rate limiting for defense-in-depth.",
      });
    }

    // 2. CSRF token detection
    const hasCsrfToken = lowerBody.includes("csrf") || lowerBody.includes("_token") ||
      lowerBody.includes("authenticity_token") || lowerBody.includes("x-csrf") ||
      /<input[^>]+type=["']?hidden["']?[^>]+name=["'][^"']*token[^"']*["']/i.test(body);
    const hasFormPost = /<form[^>]+method=["']post["']/i.test(body);

    if (hasFormPost && !hasCsrfToken) {
      await addLog("WARN", `No visible CSRF token on form at: ${authUrl}`);
      findings.push({
        title: "Missing CSRF token on login/signup form",
        description: `The form at ${authUrl} submits via POST but no CSRF token was detected in the HTML. Without CSRF protection, an attacker can craft a malicious page that silently submits the login form on behalf of a victim, enabling account takeover via pre-authentication CSRF.`,
        endpoint: authUrl,
        severity: "MEDIUM",
        cvss: "5.4",
        cwe: "CWE-352",
        owasp: "A01",
        pocCode: `<!-- CSRF PoC — hosted on attacker.com -->\n<html><body onload="document.forms[0].submit()">\n  <form action="${authUrl}" method="POST">\n    <input name="email" value="victim@target.com" />\n    <input name="password" value="attacker_password" />\n  </form>\n</body></html>`,
        fixPatch: `// Express.js with csurf:\nimport csrf from 'csurf';\nconst csrfProtection = csrf({ cookie: true });\napp.get('/login', csrfProtection, (req, res) => {\n  res.render('login', { csrfToken: req.csrfToken() });\n});\napp.post('/login', csrfProtection, loginHandler);`,
        fixExplanation: "Add CSRF tokens to all state-changing forms. Validate tokens server-side before processing the request. Use the SameSite=Strict cookie attribute as an additional layer.",
      });
    }

    // 3. Form action HTTP check
    const formActionMatch = body.match(/<form[^>]+action=["']([^"']+)["']/i);
    if (formActionMatch) {
      const actionUrl = formActionMatch[1];
      if (actionUrl.startsWith("http://")) {
        await addLog("ERROR", `⚠️  Form posts credentials to HTTP: ${actionUrl}`);
        findings.push({
          title: "Login form submits credentials over HTTP (CRITICAL)",
          description: `The login form at ${authUrl} submits to an HTTP (unencrypted) endpoint: ${actionUrl}. Passwords and credentials are transmitted in plaintext and can be intercepted by any network observer.`,
          endpoint: authUrl,
          severity: "CRITICAL",
          cvss: "9.1",
          cwe: "CWE-319",
          owasp: "A02",
          fixExplanation: `Change the form action to use HTTPS: ${actionUrl.replace("http://", "https://")}. Enforce HTTPS everywhere and set HSTS.`,
        });
      }
    }

    // 4. OAuth/SSO detection
    const hasGithubOAuth = lowerBody.includes("github") && (lowerBody.includes("oauth") || lowerBody.includes("sign in with") || lowerBody.includes("continue with"));
    const hasGoogleOAuth = lowerBody.includes("google") && (lowerBody.includes("oauth") || lowerBody.includes("sign in with") || lowerBody.includes("continue with"));
    const hasMicrosoftOAuth = lowerBody.includes("microsoft") && lowerBody.includes("sign in");

    if (hasGithubOAuth || hasGoogleOAuth || hasMicrosoftOAuth) {
      const providers = [hasGithubOAuth && "GitHub", hasGoogleOAuth && "Google", hasMicrosoftOAuth && "Microsoft"].filter(Boolean).join(", ");
      await addLog("DEBUG", `OAuth providers detected: ${providers}`);

      // Check for account recovery info
      const hasRecovery = lowerBody.includes("forgot") || lowerBody.includes("recover") || lowerBody.includes("reset password");
      if (!hasRecovery) {
        findings.push({
          title: `OAuth login (${providers}) with no account recovery fallback visible`,
          description: `OAuth via ${providers} is available at ${authUrl} but no account recovery option (password reset, backup codes) is visible. If a user's OAuth provider account is compromised or deleted, they may be permanently locked out.`,
          endpoint: authUrl,
          severity: "LOW",
          cvss: "2.5",
          cwe: "CWE-640",
          owasp: "A07",
          fixExplanation: "Provide account recovery options (backup email, recovery codes) for OAuth-authenticated users. This ensures account access isn't solely dependent on the OAuth provider.",
        });
      }
    }

    // 5. MFA/2FA detection
    const hasMFA = lowerBody.includes("two-factor") || lowerBody.includes("2fa") || lowerBody.includes("mfa") ||
      lowerBody.includes("authenticator") || lowerBody.includes("one-time") || lowerBody.includes("totp");
    if (!hasMFA) {
      await addLog("DEBUG", `No visible MFA option on: ${authUrl}`);
      findings.push({
        title: "No Multi-Factor Authentication (MFA) option visible",
        description: `The authentication page at ${authUrl} does not show any MFA/2FA option. Without MFA, a single compromised password grants full account access. MFA eliminates 99.9% of account takeover attacks.`,
        endpoint: authUrl,
        severity: "MEDIUM",
        cvss: "5.9",
        cwe: "CWE-308",
        owasp: "A07",
        tags: ["no-mfa", "auth", "mfa"],
        fixExplanation: "Implement TOTP-based MFA (Google Authenticator compatible) or WebAuthn/Passkeys. Use a library like speakeasy (Node.js) or pyotp (Python). Offer MFA as required for admin accounts and optional for regular users.",
      });
    }

    // 6. Role/plan enum exposure in signup
    const hasRoleSelector = /<select[^>]*name=["']?role["']?|type=["']?radio["'][^>]*value=["']?admin["']?|<option[^>]*>Admin<\/option>/i.test(body);
    if (hasRoleSelector) {
      await addLog("ERROR", `⚠️  Role selector exposed in signup form at: ${authUrl}`);
      findings.push({
        title: "Elevated role selectable on client-side signup form",
        description: `The signup form at ${authUrl} contains a client-side role selector that includes elevated roles (admin, moderator, etc.). Users can manipulate the form to register with elevated privileges, bypassing authorization controls.`,
        endpoint: authUrl,
        severity: "CRITICAL",
        cvss: "9.1",
        cwe: "CWE-269",
        owasp: "A01",
        pocCode: `# Modify role field to admin before submission:\n# In browser DevTools: document.querySelector('[name="role"]').value = "admin"\n# Or via curl:\ncurl -X POST ${authUrl} --data "email=attacker@evil.com&password=Pass123&role=admin"`,
        fixExplanation: "Remove role selectors from client-facing registration forms. Assign roles server-side only based on business logic (e.g., email domain, admin-granted promotion). Never trust client-provided role values.",
      });
    }

    // 7. Password field min length
    const passwordFieldMatch = body.match(/<input[^>]+type=["']password["'][^>]*/i);
    if (passwordFieldMatch) {
      const passwordField = passwordFieldMatch[0];
      const hasMinLength = /minlength=["']?\d/i.test(passwordField);
      if (!hasMinLength) {
        await addLog("DEBUG", "Password field lacks minlength attribute");
        findings.push({
          title: "Password field missing minlength attribute",
          description: `The password field at ${authUrl} does not have a minlength HTML attribute. While server-side validation is what ultimately matters, missing client-side hints allow users to set very weak passwords without immediate feedback.`,
          endpoint: authUrl,
          severity: "LOW",
          cvss: "2.5",
          cwe: "CWE-521",
          owasp: "A07",
          fixExplanation: `Add minlength="12" to your password input field and enforce the same minimum on the server side. Recommend using password strength meters (zxcvbn library) to guide users toward stronger passwords.`,
        });
      }
    }
  }

  await addLog("DEBUG", `[Module 3] Auth security complete — ${findings.length} issue(s) found`);
  return findings;
}
