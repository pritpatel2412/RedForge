import type { ScanContext, FindingInput } from "./types.js";

/**
 * Module 9: DNS Security & Subdomain Reconnaissance
 * - SPF/DMARC/DKIM record verification (email spoofing risk)
 * - CAA record check (unauthorized certificate issuance)
 * - Subdomain enumeration via Certificate Transparency (crt.sh)
 * - Dangling CNAME detection (subdomain takeover)
 * Uses DNS-over-HTTPS (Google/Cloudflare) for serverless compatibility
 */

interface DnsRecord {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

async function dnsQuery(name: string, type: string, safeFetch: ScanContext['safeFetch']): Promise<DnsRecord[]> {
  const resp = await safeFetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, {
    timeoutMs: 6000,
  });
  if (!resp) return [];
  try {
    const data = await resp.json() as any;
    return (data.Answer || []) as DnsRecord[];
  } catch {
    return [];
  }
}

async function enumerateSubdomains(domain: string, safeFetch: ScanContext['safeFetch']): Promise<string[]> {
  try {
    const resp = await safeFetch(`https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`, {
      timeoutMs: 12000,
    });
    if (!resp) return [];
    const data = await resp.json() as any[];
    const subdomains = new Set<string>();
    for (const entry of data.slice(0, 500)) {
      const names = (entry.name_value || '').split('\n');
      for (const name of names) {
        const clean = name.trim().toLowerCase().replace(/^\*\./, '');
        if (clean.endsWith(domain) && clean !== domain && !clean.includes(' ')) {
          subdomains.add(clean);
        }
      }
    }
    return [...subdomains].slice(0, 100);
  } catch {
    return [];
  }
}

export async function runDNSSecurityModule(ctx: ScanContext): Promise<FindingInput[]> {
  const findings: FindingInput[] = [];
  const { targetUrl, hostname, addLog, safeFetch } = ctx;

  await addLog("INFO", "[Module 9] DNS security & subdomain reconnaissance...");

  // Extract root domain (handle subdomains like app.example.com → example.com)
  const parts = hostname.split('.');
  const rootDomain = parts.length > 2 ? parts.slice(-2).join('.') : hostname;

  // 1. SPF Record Check
  await addLog("DEBUG", `Checking SPF record for ${rootDomain}...`);
  const txtRecords = await dnsQuery(rootDomain, 'TXT', safeFetch);
  const spfRecords = txtRecords.filter(r => r.data?.includes('v=spf1'));

  if (spfRecords.length === 0) {
    await addLog("ERROR", `⚠️  No SPF record found for ${rootDomain}`);
    findings.push({
      title: `Missing SPF record — email spoofing possible for ${rootDomain}`,
      description: `No SPF (Sender Policy Framework) TXT record was found for ${rootDomain}. Without SPF, any mail server can send emails claiming to be from @${rootDomain}. Attackers can spoof emails for phishing, password resets, and social engineering attacks that appear to come from your domain.`,
      endpoint: `dns://${rootDomain}/TXT`,
      severity: "MEDIUM",
      cvss: "5.3",
      cwe: "CWE-290",
      owasp: "A07",
      confidence: 0.95,
      tags: ["dns", "email-spoofing", "spf"],
      pocCode: `# Verify missing SPF:\ndig TXT ${rootDomain} | grep spf\nnslookup -type=TXT ${rootDomain}\n\n# Test email spoofing (use with authorization):\nswaks --to victim@target.com --from ceo@${rootDomain} --server mail.${rootDomain}`,
      fixPatch: `# Add SPF TXT record to your DNS:\n${rootDomain}. IN TXT "v=spf1 include:_spf.google.com include:amazonses.com ~all"\n\n# Strict SPF (recommended):\n${rootDomain}. IN TXT "v=spf1 include:_spf.google.com -all"`,
      fixExplanation: "Add an SPF TXT record listing all authorized mail servers. Use '-all' (hard fail) instead of '~all' (soft fail). SPF alone is insufficient — combine with DKIM and DMARC for full protection.",
    });
  } else {
    const spfData = spfRecords[0].data;
    if (spfData.includes('+all') || spfData.includes('?all')) {
      await addLog("WARN", `SPF record is permissive: ${spfData}`);
      findings.push({
        title: `Permissive SPF record — effectively allows any sender`,
        description: `The SPF record for ${rootDomain} uses a permissive qualifier (+all or ?all): "${spfData}". This does not meaningfully restrict who can send email as @${rootDomain}.`,
        endpoint: `dns://${rootDomain}/TXT`,
        severity: "MEDIUM",
        cvss: "5.3",
        cwe: "CWE-290",
        owasp: "A07",
        confidence: 0.9,
        tags: ["dns", "email-spoofing", "spf", "permissive"],
        fixExplanation: "Change '+all' or '?all' to '-all' (hard fail) in your SPF record. This tells receiving mail servers to reject emails from unauthorized senders.",
      });
    } else {
      await addLog("DEBUG", `SPF record found: ${spfData.slice(0, 100)} ✓`);
    }
  }

  // 2. DMARC Record Check
  await addLog("DEBUG", `Checking DMARC record for ${rootDomain}...`);
  const dmarcRecords = await dnsQuery(`_dmarc.${rootDomain}`, 'TXT', safeFetch);
  const dmarc = dmarcRecords.find(r => r.data?.includes('v=DMARC1'));

  if (!dmarc) {
    await addLog("ERROR", `⚠️  No DMARC record for ${rootDomain}`);
    findings.push({
      title: `Missing DMARC record — no email authentication policy for ${rootDomain}`,
      description: `No DMARC record found at _dmarc.${rootDomain}. DMARC tells receiving mail servers what to do when SPF/DKIM checks fail. Without DMARC, spoofed emails pass through even if SPF is configured, because there's no enforcement policy. Phishing attacks using your domain will reach victims' inboxes.`,
      endpoint: `dns://_dmarc.${rootDomain}/TXT`,
      severity: "MEDIUM",
      cvss: "5.3",
      cwe: "CWE-290",
      owasp: "A07",
      confidence: 0.95,
      tags: ["dns", "email-spoofing", "dmarc"],
      pocCode: `# Verify missing DMARC:\ndig TXT _dmarc.${rootDomain}\nnslookup -type=TXT _dmarc.${rootDomain}`,
      fixPatch: `# Add DMARC TXT record:\n_dmarc.${rootDomain}. IN TXT "v=DMARC1; p=reject; rua=mailto:dmarc@${rootDomain}; ruf=mailto:dmarc-forensic@${rootDomain}; fo=1"`,
      fixExplanation: "Add a DMARC TXT record with p=reject to instruct mail servers to reject unauthenticated emails. Start with p=none to monitor, then escalate to p=quarantine and p=reject after verifying legitimate email flows.",
    });
  } else {
    const dmarcData = dmarc.data;
    if (dmarcData.includes('p=none')) {
      await addLog("WARN", `DMARC policy is set to 'none' — monitoring only, no enforcement`);
      findings.push({
        title: `DMARC policy set to 'none' — spoofed emails not blocked`,
        description: `The DMARC record for ${rootDomain} has p=none: "${dmarcData}". This only monitors email authentication failures without taking action. Spoofed emails still reach recipients normally.`,
        endpoint: `dns://_dmarc.${rootDomain}/TXT`,
        severity: "LOW",
        cvss: "3.7",
        cwe: "CWE-290",
        owasp: "A07",
        confidence: 0.9,
        tags: ["dns", "email-spoofing", "dmarc", "no-enforcement"],
        fixExplanation: "Upgrade DMARC policy: p=none → p=quarantine → p=reject. Review DMARC aggregate reports (rua) to identify legitimate senders before enforcing.",
      });
    } else {
      await addLog("DEBUG", `DMARC record found with enforcement ✓`);
    }
  }

  // 3. CAA Record Check
  await addLog("DEBUG", `Checking CAA records for ${rootDomain}...`);
  const caaRecords = await dnsQuery(rootDomain, 'CAA', safeFetch);
  if (caaRecords.length === 0) {
    findings.push({
      title: `Missing CAA records — any CA can issue certificates for ${rootDomain}`,
      description: `No Certificate Authority Authorization (CAA) DNS records found for ${rootDomain}. Without CAA, any Certificate Authority can issue TLS certificates for your domain. An attacker who compromises or tricks a CA can obtain valid HTTPS certificates for your domain to perform man-in-the-middle attacks.`,
      endpoint: `dns://${rootDomain}/CAA`,
      severity: "LOW",
      cvss: "3.7",
      cwe: "CWE-295",
      owasp: "A02",
      confidence: 0.9,
      tags: ["dns", "caa", "certificate-authority"],
      fixPatch: `# Add CAA records (only allow Let's Encrypt and your CA):\n${rootDomain}. IN CAA 0 issue "letsencrypt.org"\n${rootDomain}. IN CAA 0 issuewild ";"\n${rootDomain}. IN CAA 0 iodef "mailto:security@${rootDomain}"`,
      fixExplanation: "Add CAA DNS records to restrict which CAs can issue certificates for your domain. Include an iodef record to receive violation reports.",
    });
  }

  // 4. Subdomain Enumeration via Certificate Transparency
  await addLog("INFO", `Enumerating subdomains for ${rootDomain} via Certificate Transparency...`);
  const subdomains = await enumerateSubdomains(rootDomain, safeFetch);

  if (subdomains.length > 0) {
    await addLog("INFO", `Found ${subdomains.length} subdomain(s) for ${rootDomain}`);

    // Check for potentially sensitive subdomains
    const sensitivePatterns = [
      'admin', 'staging', 'dev', 'test', 'internal', 'vpn', 'api', 'beta',
      'debug', 'backup', 'jenkins', 'gitlab', 'jira', 'grafana', 'kibana',
      'monitor', 'phpmyadmin', 'mysql', 'postgres', 'redis', 'elastic',
      'mail', 'webmail', 'ftp', 'ssh', 'db', 'database', 'old', 'legacy',
    ];

    const sensitiveSubdomains = subdomains.filter(sd =>
      sensitivePatterns.some(p => sd.includes(p))
    );

    if (sensitiveSubdomains.length > 0) {
      await addLog("WARN", `Sensitive subdomains found: ${sensitiveSubdomains.slice(0, 10).join(', ')}`);
      findings.push({
        title: `${sensitiveSubdomains.length} sensitive subdomain(s) discovered via Certificate Transparency`,
        description: `Certificate Transparency logs reveal ${subdomains.length} subdomain(s) for ${rootDomain}, including ${sensitiveSubdomains.length} with sensitive names:\n\n${sensitiveSubdomains.slice(0, 15).map(s => `• ${s}`).join('\n')}\n\nThese subdomains may expose admin panels, development environments, or internal infrastructure to the internet.`,
        endpoint: `https://crt.sh/?q=%25.${rootDomain}`,
        severity: "MEDIUM",
        cvss: "5.3",
        cwe: "CWE-200",
        owasp: "A05",
        confidence: 0.8,
        tags: ["dns", "subdomain", "recon", ...sensitiveSubdomains.slice(0, 5)],
        pocCode: `# Subdomain enumeration:\ncurl -s "https://crt.sh/?q=%25.${rootDomain}&output=json" | jq '.[].name_value' | sort -u\n\n# Check if sensitive subdomains are accessible:\n${sensitiveSubdomains.slice(0, 3).map(s => `curl -I https://${s}`).join('\n')}`,
        fixExplanation: "Audit all subdomains. Remove DNS records for unused subdomains. Ensure development/staging environments are protected with authentication or IP restrictions. Use wildcard certificates carefully as they appear in CT logs.",
      });
    }

    // 5. Dangling CNAME check (subdomain takeover) — check first 20 subdomains
    await addLog("DEBUG", "Checking for dangling CNAMEs (subdomain takeover)...");
    const takeoverServices = [
      'github.io', 'herokuapp.com', 'surge.sh', 'bitbucket.io',
      'ghost.io', 'netlify.app', 'now.sh', 'vercel.app',
      'azurewebsites.net', 'cloudapp.azure.com', 's3.amazonaws.com',
      'elasticbeanstalk.com', 'wpengine.com', 'pantheon.io',
    ];

    for (const subdomain of subdomains.slice(0, 20)) {
      const cnameRecords = await dnsQuery(subdomain, 'CNAME', safeFetch);
      for (const cname of cnameRecords) {
        const target = cname.data?.toLowerCase() || '';
        const matchedService = takeoverServices.find(s => target.includes(s));
        if (matchedService) {
          // Check if the CNAME target resolves
          const targetResp = await safeFetch(`https://${subdomain}`, { timeoutMs: 5000 });
          if (!targetResp || targetResp.status === 404) {
            await addLog("ERROR", `⚠️  Potential subdomain takeover: ${subdomain} → ${target} (${matchedService})`);
            findings.push({
              title: `Subdomain takeover risk: ${subdomain} → ${matchedService}`,
              description: `The subdomain ${subdomain} has a CNAME pointing to ${target} (${matchedService}), but the underlying service appears unclaimed/deleted. An attacker can register the same resource on ${matchedService} and serve malicious content from ${subdomain}, inheriting your domain's trust and cookie scope.`,
              endpoint: `https://${subdomain}`,
              severity: "HIGH",
              cvss: "8.1",
              cwe: "CWE-200",
              owasp: "A05",
              confidence: 0.75,
              tags: ["dns", "subdomain-takeover", matchedService],
              pocCode: `# Verify dangling CNAME:\ndig CNAME ${subdomain}\n# Result: ${target}\n\n# Check if target responds:\ncurl -I https://${subdomain}\n# If 404/NXDOMAIN → takeover possible`,
              fixExplanation: `Remove the DNS CNAME record for ${subdomain} since the ${matchedService} resource is no longer active. If the service is still needed, reclaim the resource on ${matchedService}.`,
            });
          }
        }
      }
    }
  }

  await addLog("DEBUG", `[Module 9] DNS security complete — ${findings.length} issue(s) found`);
  return findings;
}
