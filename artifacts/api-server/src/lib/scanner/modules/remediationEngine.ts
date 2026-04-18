/**
 * Auto-Remediation Engine (#1)
 * Generates ready-to-paste fix code for every finding category.
 * Maps finding tags/titles to language-specific code snippets.
 */
import type { FindingInput, RemediationCode } from "./types.js";

// ─── Remediation Snippets Library ────────────────────────────────────────────

const NGINX_HSTS = `# Add inside your server {} block (HTTPS only)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;`;

const APACHE_HSTS = `# Add to your VirtualHost (HTTPS) or .htaccess
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"`;

const EXPRESS_HSTS = `// Install: npm install helmet
import helmet from 'helmet';
app.use(helmet.hsts({
  maxAge: 31536000,
  includeSubDomains: true,
  preload: true,
}));`;

const NGINX_CSP = `# Strict Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'nonce-{RANDOM}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self';" always;`;

const EXPRESS_CSP = `// Install: npm install helmet
import helmet from 'helmet';
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],          // add nonces for inline scripts
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
  },
}));`;

const NGINX_XFRAME = `add_header X-Frame-Options "DENY" always;
# Or use CSP frame-ancestors (preferred):
add_header Content-Security-Policy "frame-ancestors 'none';" always;`;

const NGINX_XCTYPE = `add_header X-Content-Type-Options "nosniff" always;`;

const NGINX_REFERRER = `add_header Referrer-Policy "strict-origin-when-cross-origin" always;`;

const NGINX_PERMISSIONS = `add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;`;

const NGINX_HTTPS_REDIRECT = `# HTTP → HTTPS redirect block
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}`;

const COOKIE_HTTPONLY = `// Express.js — set HttpOnly on session cookies
app.use(session({
  name: 'sessionId',
  secret: process.env.SESSION_SECRET,
  cookie: {
    httpOnly: true,   // prevents JS access
    secure: true,     // HTTPS only
    sameSite: 'strict',
    maxAge: 3600000,  // 1 hour
  },
}));`;

const COOKIE_SECURE = `// Set Secure flag on all cookies
res.cookie('name', 'value', {
  secure: true,       // HTTPS only
  httpOnly: true,
  sameSite: 'strict',
});`;

const CSRF_EXPRESS = `// Install: npm install csurf
import csrf from 'csurf';
const csrfProtection = csrf({ cookie: { httpOnly: true, secure: true } });
app.use(csrfProtection);

// In your form template:
// <input type="hidden" name="_csrf" value="{{ csrfToken() }}">`;

const SPF_DNS = `; Add this TXT record to your DNS zone (replace with your mail providers)
yourdomain.com. IN TXT "v=spf1 include:_spf.google.com include:sendgrid.net ~all"
; ~all = softfail (log but allow). Use -all (hardfail) for strict enforcement.`;

const DMARC_DNS = `; Add this TXT record to your DNS zone
_dmarc.yourdomain.com. IN TXT "v=DMARC1; p=reject; rua=mailto:dmarc-reports@yourdomain.com; ruf=mailto:dmarc-forensics@yourdomain.com; fo=1; pct=100"
; p=reject → reject emails failing SPF+DKIM
; p=quarantine → send to spam (use during rollout)
; rua → aggregate report address`;

const DKIM_DNS = `; Add this TXT record (generate keys with: openssl genrsa -out dkim_private.pem 2048)
selector._domainkey.yourdomain.com. IN TXT "v=DKIM1; k=rsa; p=<your-public-key-here>"`;

const CAA_DNS = `; Restrict which CAs can issue SSL certs for your domain
yourdomain.com. IN CAA 0 issue "letsencrypt.org"
yourdomain.com. IN CAA 0 issuewild ";"      ; disable wildcard certs
yourdomain.com. IN CAA 0 iodef "mailto:security@yourdomain.com"`;

const GRAPHQL_DISABLE_INTROSPECTION = `// Apollo Server — disable introspection in production
import { ApolloServer } from '@apollo/server';
const server = new ApolloServer({
  schema,
  introspection: process.env.NODE_ENV !== 'production',
});

// Express/Fastify middleware alternative:
app.use('/graphql', (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.body?.query?.includes('__schema')) {
    return res.status(403).json({ error: 'GraphQL introspection disabled in production' });
  }
  next();
});`;

const GRAPHQL_AUTH = `// Add authentication middleware to all GraphQL mutations
const resolvers = {
  Mutation: {
    updateUser: async (_, args, context) => {
      if (!context.user) throw new GraphQLError('Unauthorized', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
      // ... resolver logic
    },
  },
};`;

const SQLI_PARAMETERIZED = `// ❌ Vulnerable (string interpolation)
const rows = await db.query(\`SELECT * FROM users WHERE id = \${req.params.id}\`);

// ✅ Fixed (parameterized query)
const rows = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);

// With an ORM (Drizzle):
const user = await db.select().from(users).where(eq(users.id, userId));`;

const XSS_SANITIZE = `// Install: npm install dompurify (browser) or isomorphic-dompurify (Node)
import DOMPurify from 'dompurify';

// ❌ Vulnerable
element.innerHTML = userInput;

// ✅ Fixed
element.innerHTML = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
  ALLOWED_ATTR: ['href'],
});

// For React — never use dangerouslySetInnerHTML with user input:
// ❌ <div dangerouslySetInnerHTML={{ __html: userContent }} />
// ✅ Use a sanitized renderer or react-html-parser with whitelist`;

const SSRF_VALIDATE = `// Validate URLs before making server-side requests
import { URL } from 'url';

function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    // Block private IP ranges and localhost
    const privateRanges = /^(127\\.\\d+\\.\\d+\\.\\d+|10\\.\\d+\\.\\d+\\.\\d+|172\\.(1[6-9]|2\\d|3[01])\\.\\d+\\.\\d+|192\\.168\\.\\d+\\.\\d+|localhost|0\\.0\\.0\\.0|::1)$/i;
    if (privateRanges.test(url.hostname)) return false;
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    return true;
  } catch { return false; }
}`;

const OPEN_REDIRECT_FIX = `// Whitelist allowed redirect destinations
const ALLOWED_HOSTS = ['yourdomain.com', 'app.yourdomain.com'];

function safeRedirect(res: Response, url: string) {
  try {
    const parsed = new URL(url, 'https://yourdomain.com');
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return res.redirect('/');  // fallback to home
    }
    return res.redirect(parsed.href);
  } catch {
    return res.redirect('/');
  }
}`;

const CORS_FIX = `// Restrict CORS to specific origins
const allowedOrigins = ['https://yourdomain.com', 'https://app.yourdomain.com'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));`;

const WP_HARDENING = `# WordPress hardening (wp-config.php)
define('DISALLOW_FILE_EDIT', true);       // disable theme/plugin editor
define('DISALLOW_FILE_MODS', true);       // disable plugin installation
define('FORCE_SSL_ADMIN', true);

# Disable XML-RPC (nginx)
location = /xmlrpc.php {
    deny all;
    return 403;
}

# Protect wp-admin (IP whitelist)
location /wp-admin {
    allow YOUR.OFFICE.IP.ADDRESS;
    deny all;
}

# Hide WP version
# In functions.php:
# remove_action('wp_head', 'wp_generator');`;

const RATE_LIMIT_EXPRESS = `// Install: npm install express-rate-limit
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                     // 10 attempts per window
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);`;

// ─── Remediation Tag Map ──────────────────────────────────────────────────────

interface RemediationTemplate {
  tags: string[];          // finding tags that trigger this template
  titleKeywords?: string[]; // or title substring match
  snippets: RemediationCode[];
}

const REMEDIATION_TEMPLATES: RemediationTemplate[] = [
  {
    tags: ["hsts"],
    snippets: [
      { language: "nginx", label: "nginx.conf snippet", code: NGINX_HSTS },
      { language: "apache", label: "Apache .htaccess", code: APACHE_HSTS },
      { language: "javascript", label: "Express.js (helmet)", code: EXPRESS_HSTS },
    ],
  },
  {
    tags: ["csp"],
    titleKeywords: ["content security policy", "csp"],
    snippets: [
      { language: "nginx", label: "nginx.conf snippet", code: NGINX_CSP },
      { language: "javascript", label: "Express.js (helmet)", code: EXPRESS_CSP },
    ],
  },
  {
    tags: ["xframe", "clickjacking"],
    titleKeywords: ["x-frame", "clickjacking", "frame-ancestors"],
    snippets: [
      { language: "nginx", label: "nginx.conf snippet", code: NGINX_XFRAME },
    ],
  },
  {
    tags: ["xctype"],
    titleKeywords: ["x-content-type", "mime sniff"],
    snippets: [
      { language: "nginx", label: "nginx.conf snippet", code: NGINX_XCTYPE },
    ],
  },
  {
    tags: ["referrer"],
    titleKeywords: ["referrer-policy", "referrer policy"],
    snippets: [
      { language: "nginx", label: "nginx.conf snippet", code: NGINX_REFERRER },
    ],
  },
  {
    tags: ["permissions"],
    titleKeywords: ["permissions-policy"],
    snippets: [
      { language: "nginx", label: "nginx.conf snippet", code: NGINX_PERMISSIONS },
    ],
  },
  {
    tags: ["http-redirect"],
    titleKeywords: ["http to https", "http redirect", "insecure http"],
    snippets: [
      { language: "nginx", label: "nginx.conf redirect block", code: NGINX_HTTPS_REDIRECT },
    ],
  },
  {
    tags: ["httponly", "cookie"],
    titleKeywords: ["httponly", "cookie"],
    snippets: [
      { language: "javascript", label: "Express.js session cookie", code: COOKIE_HTTPONLY },
      { language: "javascript", label: "res.cookie() call", code: COOKIE_SECURE },
    ],
  },
  {
    tags: ["csrf"],
    titleKeywords: ["csrf"],
    snippets: [
      { language: "javascript", label: "Express.js CSRF middleware", code: CSRF_EXPRESS },
    ],
  },
  {
    tags: ["spf"],
    titleKeywords: ["spf"],
    snippets: [
      { language: "dns", label: "DNS TXT record (SPF)", code: SPF_DNS },
    ],
  },
  {
    tags: ["dmarc"],
    titleKeywords: ["dmarc"],
    snippets: [
      { language: "dns", label: "DNS TXT record (DMARC)", code: DMARC_DNS },
    ],
  },
  {
    tags: ["caa"],
    titleKeywords: ["caa"],
    snippets: [
      { language: "dns", label: "DNS CAA records", code: CAA_DNS },
    ],
  },
  {
    tags: ["graphql"],
    titleKeywords: ["graphql", "introspection"],
    snippets: [
      { language: "javascript", label: "Disable GraphQL introspection", code: GRAPHQL_DISABLE_INTROSPECTION },
      { language: "javascript", label: "Add auth to mutations", code: GRAPHQL_AUTH },
    ],
  },
  {
    tags: ["sqli", "sql-injection"],
    titleKeywords: ["sql injection", "sql"],
    snippets: [
      { language: "javascript", label: "Parameterized queries (Node.js)", code: SQLI_PARAMETERIZED },
    ],
  },
  {
    tags: ["xss", "reflected", "dom-xss"],
    titleKeywords: ["xss", "cross-site scripting"],
    snippets: [
      { language: "javascript", label: "DOMPurify sanitization", code: XSS_SANITIZE },
    ],
  },
  {
    tags: ["ssrf"],
    titleKeywords: ["ssrf", "server-side request forgery"],
    snippets: [
      { language: "javascript", label: "URL allowlist validation", code: SSRF_VALIDATE },
    ],
  },
  {
    tags: ["open-redirect"],
    titleKeywords: ["open redirect", "redirect"],
    snippets: [
      { language: "javascript", label: "Safe redirect with allowlist", code: OPEN_REDIRECT_FIX },
    ],
  },
  {
    tags: ["cors"],
    titleKeywords: ["cors", "cross-origin"],
    snippets: [
      { language: "javascript", label: "CORS origin allowlist (Express)", code: CORS_FIX },
    ],
  },
  {
    tags: ["wordpress", "wp"],
    titleKeywords: ["wordpress", "wp-admin", "xmlrpc"],
    snippets: [
      { language: "nginx", label: "WordPress hardening (nginx + wp-config)", code: WP_HARDENING },
    ],
  },
  {
    tags: ["rate-limit", "brute-force", "captcha"],
    titleKeywords: ["rate limit", "brute force", "captcha"],
    snippets: [
      { language: "javascript", label: "express-rate-limit", code: RATE_LIMIT_EXPRESS },
    ],
  },
];

// ─── Main Enrichment Function ─────────────────────────────────────────────────

export function enrichWithRemediation(findings: FindingInput[]): FindingInput[] {
  return findings.map(finding => {
    if (finding.remediationCode?.length) return finding; // already has code

    const titleLower = finding.title.toLowerCase();
    const findingTags = finding.tags || [];

    const matched: RemediationCode[] = [];

    for (const tpl of REMEDIATION_TEMPLATES) {
      const tagMatch    = tpl.tags.some(t => findingTags.includes(t));
      const titleMatch  = tpl.titleKeywords?.some(kw => titleLower.includes(kw));

      if (tagMatch || titleMatch) {
        matched.push(...tpl.snippets);
      }
    }

    if (matched.length) {
      return { ...finding, remediationCode: matched };
    }
    return finding;
  });
}
