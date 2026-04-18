function extractLibFromUrl(url) {
    // jsdelivr: /npm/library@version/file.js
    const jsdelivrMatch = url.match(/jsdelivr\.net\/npm\/([^@/]+)@([^/]+)/i);
    if (jsdelivrMatch)
        return { name: jsdelivrMatch[1], version: jsdelivrMatch[2] };
    // cdnjs: /cdnjs.cloudflare.com/ajax/libs/library/version/file.js
    const cdnjsMatch = url.match(/cdnjs\.cloudflare\.com\/ajax\/libs\/([^/]+)\/([^/]+)/i);
    if (cdnjsMatch)
        return { name: cdnjsMatch[1], version: cdnjsMatch[2] };
    // unpkg: /package@version/file
    const unpkgMatch = url.match(/unpkg\.com\/([^@/]+)@([^/]+)/i);
    if (unpkgMatch)
        return { name: unpkgMatch[1], version: unpkgMatch[2] };
    return null;
}
async function checkOSVVulnerabilities(packageName, version) {
    try {
        const response = await fetch("https://api.osv.dev/v1/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                version,
                package: { name: packageName, ecosystem: "npm" },
            }),
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok)
            return [];
        const data = await response.json();
        const vulns = data.vulns || [];
        return vulns.slice(0, 3).map((v) => ({
            vulnId: v.id || "UNKNOWN",
            summary: (v.summary || v.details || "Vulnerability found").slice(0, 150),
            severity: v.severity?.[0]?.score ? `CVSS ${v.severity[0].score}` : "Unknown severity",
        }));
    }
    catch {
        return [];
    }
}
export async function runSupplyChainModule(ctx) {
    const findings = [];
    const { targetUrl, bodyText, reachable, addLog } = ctx;
    await addLog("INFO", "[Module 6] Dependency & supply chain analysis — CDN scripts, SRI, vulnerabilities...");
    if (!reachable || !bodyText) {
        await addLog("WARN", "[Module 6] Target unreachable — skipping supply chain analysis");
        return findings;
    }
    // Extract all external script/CSS resources
    const externalScripts = [];
    // Scripts
    const scriptPattern = /<script[^>]+src=["']([^"']+)["'][^>]*/gi;
    let scriptMatch;
    while ((scriptMatch = scriptPattern.exec(bodyText)) !== null) {
        const rawUrl = scriptMatch[0];
        const src = scriptMatch[1];
        const isExternal = src.startsWith("http") || src.startsWith("//");
        if (!isExternal)
            continue;
        const fullUrl = src.startsWith("//") ? "https:" + src : src;
        const hasSRI = /integrity=["'][^"']+["']/.test(rawUrl);
        const isHttp = fullUrl.startsWith("http://");
        const libInfo = extractLibFromUrl(fullUrl);
        externalScripts.push({
            url: fullUrl,
            hasSRI,
            isHttp,
            libName: libInfo?.name,
            libVersion: libInfo?.version,
        });
    }
    // Stylesheets
    const linkPattern = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
    let linkMatch;
    while ((linkMatch = linkPattern.exec(bodyText)) !== null) {
        const rawLink = linkMatch[0];
        const href = linkMatch[1];
        const isExternal = href.startsWith("http") || href.startsWith("//");
        if (!isExternal)
            continue;
        const fullUrl = href.startsWith("//") ? "https:" + href : href;
        const hasSRI = /integrity=["'][^"']+["']/.test(rawLink);
        const isHttp = fullUrl.startsWith("http://");
        externalScripts.push({ url: fullUrl, hasSRI, isHttp });
    }
    await addLog("DEBUG", `Found ${externalScripts.length} external resource(s) to analyze`);
    if (externalScripts.length === 0) {
        await addLog("DEBUG", "[Module 6] No external CDN resources found");
        return findings;
    }
    // 1. HTTP scripts (MitM risk — highest priority)
    const httpScripts = externalScripts.filter(s => s.isHttp);
    if (httpScripts.length > 0) {
        await addLog("ERROR", `⚠️  ${httpScripts.length} external resource(s) loaded over HTTP (MitM risk)`);
        findings.push({
            title: `${httpScripts.length} external resource(s) loaded over insecure HTTP`,
            description: `The following external scripts/stylesheets are loaded via HTTP (not HTTPS): ${httpScripts.slice(0, 3).map(s => s.url).join(", ")}. Any network attacker can intercept and modify these files in transit, injecting malicious JavaScript into your page (Man-in-the-Middle supply chain attack).`,
            endpoint: targetUrl,
            severity: "HIGH",
            cvss: "7.4",
            cwe: "CWE-494",
            owasp: "A06",
            pocCode: `# Intercept and modify HTTP script with mitmproxy:\nmitmproxy --mode transparent --listen-port 8080 -s inject_malicious.py\n# inject_malicious.py appends malicious JS to any HTTP response`,
            fixExplanation: "Replace all http:// CDN URLs with https://. Never load resources over HTTP. If the CDN doesn't support HTTPS, self-host the dependency.",
        });
    }
    // 2. Scripts without SRI
    const cdnScriptsWithoutSRI = externalScripts.filter(s => !s.hasSRI && !s.isHttp &&
        (s.url.includes("cdn") || s.url.includes("unpkg") || s.url.includes("jsdelivr") || s.url.includes("cdnjs")));
    if (cdnScriptsWithoutSRI.length > 0) {
        await addLog("WARN", `${cdnScriptsWithoutSRI.length} CDN resource(s) lack Subresource Integrity (SRI)`);
        findings.push({
            title: `${cdnScriptsWithoutSRI.length} CDN resource(s) missing Subresource Integrity (SRI)`,
            description: `${cdnScriptsWithoutSRI.length} externally hosted resources are loaded without SRI integrity hashes: ${cdnScriptsWithoutSRI.slice(0, 3).map(s => s.url).join(", ")}. If the CDN is compromised (e.g., CDN poisoning), modified files would execute in your users' browsers without detection.`,
            endpoint: targetUrl,
            severity: "LOW",
            cvss: "4.7",
            cwe: "CWE-353",
            owasp: "A06",
            pocCode: `# Generate SRI hash:\ncurl -s "https://cdn.example.com/lib.js" | openssl dgst -sha384 -binary | openssl base64 -A\n# Output: base64-encoded hash to use as integrity attribute`,
            fixPatch: `<!-- Add integrity and crossorigin attributes: -->\n<script\n  src="https://cdn.example.com/lib.js"\n  integrity="sha384-<generate-with-command-above>"\n  crossorigin="anonymous"\n></script>`,
            fixExplanation: "Generate SRI hashes using https://www.srihash.org/ or the openssl command. Add integrity and crossorigin attributes to all CDN-hosted resources. Consider self-hosting critical dependencies to eliminate CDN trust entirely.",
        });
    }
    // 3. Known CVE check via OSV
    const cdnLibsToCheck = externalScripts.filter(s => s.libName && s.libVersion).slice(0, 5);
    if (cdnLibsToCheck.length > 0) {
        await addLog("DEBUG", `Checking ${cdnLibsToCheck.length} CDN librar(ies) for known CVEs via OSV...`);
        for (const lib of cdnLibsToCheck) {
            if (!lib.libName || !lib.libVersion)
                continue;
            const vulns = await checkOSVVulnerabilities(lib.libName, lib.libVersion);
            if (vulns.length > 0) {
                await addLog("ERROR", `⚠️  Vulnerable library: ${lib.libName}@${lib.libVersion} — ${vulns.length} CVE(s)`);
                const vulnList = vulns.map(v => `${v.vulnId}: ${v.summary} (${v.severity})`).join("\n");
                findings.push({
                    title: `Vulnerable dependency: ${lib.libName}@${lib.libVersion} — ${vulns.length} CVE(s) found`,
                    description: `The CDN-hosted library ${lib.libName} version ${lib.libVersion} loaded from ${lib.url} has known vulnerabilities:\n\n${vulnList}\n\nOutdated frontend dependencies are a common entry point for XSS and data theft attacks.`,
                    endpoint: lib.url,
                    severity: "HIGH",
                    cvss: "7.5",
                    cwe: "CWE-1104",
                    owasp: "A06",
                    fixExplanation: `Upgrade ${lib.libName} to the latest patched version. Check https://osv.dev/list?ecosystem=npm&q=${lib.libName} for all known vulnerabilities and their fix versions. Consider self-hosting to control the version used.`,
                });
            }
            else {
                await addLog("DEBUG", `${lib.libName}@${lib.libVersion}: no known CVEs ✓`);
            }
        }
    }
    await addLog("DEBUG", `[Module 6] Supply chain complete — ${findings.length} issue(s) found`);
    return findings;
}
