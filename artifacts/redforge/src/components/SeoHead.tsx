import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

type PageSeo = { title: string; description: string };

const DEFAULT_DESCRIPTION =
  "Autonomous AI penetration testing: real HTTP security scans, live findings, severity-rated vulnerabilities, and AI remediation guidance for your APIs and web applications.";

const ROUTES: Record<string, PageSeo> = {
  "/": {
    title: "RedForge — AI Penetration Testing for Modern Teams",
    description: DEFAULT_DESCRIPTION,
  },
  "/signin": {
    title: "Sign in — RedForge",
    description: "Sign in to RedForge to run security scans, review findings, and manage your workspace.",
  },
  "/signup": {
    title: "Create account — RedForge",
    description: "Create a RedForge account and start autonomous AI penetration testing on your APIs and apps.",
  },
  "/auth/forgot-password": {
    title: "Forgot password — RedForge",
    description: "Reset your RedForge account password.",
  },
  "/auth/reset-password": {
    title: "Reset password — RedForge",
    description: "Set a new password for your RedForge account.",
  },
  "/changelog": {
    title: "Changelog — RedForge",
    description: "Product updates, new scanner capabilities, and improvements to RedForge.",
  },
  "/status": {
    title: "Status — RedForge",
    description: "Uptime and operational status for RedForge services.",
  },
  "/terms": {
    title: "Terms of Service — RedForge",
    description: "Terms of Service for using the RedForge platform.",
  },
  "/privacy": {
    title: "Privacy Policy — RedForge",
    description: "How RedForge collects, uses, and protects your data.",
  },
  "/dashboard": {
    title: "Dashboard — RedForge",
    description: "Overview of scans, findings, and workspace activity.",
  },
  "/projects": {
    title: "Projects — RedForge",
    description: "Manage penetration testing projects and targets.",
  },
  "/projects/new": {
    title: "New project — RedForge",
    description: "Create a new project and configure scan targets.",
  },
  "/scans": {
    title: "Scans — RedForge",
    description: "View and manage security scans across your workspace.",
  },
  "/findings": {
    title: "Findings — RedForge",
    description: "Browse and filter vulnerability findings from your scans.",
  },
  "/analytics": {
    title: "Analytics — RedForge",
    description: "Risk trends and security analytics for your workspace.",
  },
  "/reports": {
    title: "Reports — RedForge",
    description: "Export and review security assessment reports.",
  },
  "/settings": {
    title: "Workspace settings — RedForge",
    description: "Configure your RedForge workspace and integrations.",
  },
  "/settings/api-keys": {
    title: "API keys — RedForge",
    description: "Create and manage API keys for programmatic access.",
  },
  "/settings/billing": {
    title: "Billing — RedForge",
    description: "Subscription and billing settings.",
  },
  "/chat": {
    title: "Security assistant — RedForge",
    description: "AI security chat with full context on your findings and scans.",
  },
};

function resolveSeo(path: string): PageSeo {
  if (ROUTES[path]) return ROUTES[path]!;
  if (path.startsWith("/admin")) {
    return {
      title: "Admin — RedForge",
      description: "Administrative tools for RedForge.",
    };
  }
  if (path.startsWith("/projects/")) {
    return {
      title: "Project — RedForge",
      description: "Project details, targets, and scan history.",
    };
  }
  if (path.includes("/attack-graph")) {
    return {
      title: "Attack graph — RedForge",
      description: "Visualize attack paths and chained risk for a completed scan.",
    };
  }
  if (path.startsWith("/scans/")) {
    return {
      title: "Scan — RedForge",
      description: "Live scan progress, logs, and results.",
    };
  }
  if (path.startsWith("/findings/")) {
    return {
      title: "Finding — RedForge",
      description: "Vulnerability detail, severity, and remediation guidance.",
    };
  }
  return {
    title: "RedForge — AI Penetration Testing",
    description: DEFAULT_DESCRIPTION,
  };
}

function upsertMetaName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Updates document title, description, Open Graph, Twitter, and canonical URL on client navigation.
 * Set `VITE_PUBLIC_SITE_URL` in production so canonical and og:image use absolute URLs (required for many crawlers).
 */
export function SeoHead() {
  const [location] = useLocation();
  const jsonLdDone = useRef(false);

  useEffect(() => {
    const raw = import.meta.env.VITE_PUBLIC_SITE_URL;
    const siteUrl = typeof raw === "string" ? raw.replace(/\/$/, "") : "";
    const seo = resolveSeo(location);

    document.title = seo.title;
    upsertMetaName("description", seo.description);

    const path = location.startsWith("/") ? location : `/${location}`;
    const canonical = siteUrl ? `${siteUrl}${path}` : path;
    upsertCanonical(canonical);

    upsertMetaProperty("og:site_name", "RedForge");
    upsertMetaProperty("og:type", "website");
    upsertMetaProperty("og:title", seo.title);
    upsertMetaProperty("og:description", seo.description);
    if (siteUrl) {
      upsertMetaProperty("og:url", canonical);
    }

    const ogImage = siteUrl ? `${siteUrl}/opengraph.jpg` : "/opengraph.jpg";
    upsertMetaProperty("og:image", ogImage);

    upsertMetaName("twitter:card", "summary_large_image");
    upsertMetaName("twitter:title", seo.title);
    upsertMetaName("twitter:description", seo.description);
    upsertMetaName("twitter:image", ogImage);
  }, [location]);

  useEffect(() => {
    const raw = import.meta.env.VITE_PUBLIC_SITE_URL;
    const siteUrl = typeof raw === "string" ? raw.replace(/\/$/, "") : "";
    if (!siteUrl || jsonLdDone.current) return;
    jsonLdDone.current = true;

    const existing = document.getElementById("redforge-jsonld-website");
    if (existing) return;

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "redforge-jsonld-website";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "RedForge",
      url: siteUrl,
      description: DEFAULT_DESCRIPTION,
      publisher: {
        "@type": "Organization",
        name: "RedForge",
        url: siteUrl,
      },
    });
    document.head.appendChild(script);
  }, []);

  return null;
}
