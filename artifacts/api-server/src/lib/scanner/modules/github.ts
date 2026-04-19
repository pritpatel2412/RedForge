import type { FindingInput, ScanContext } from "./types.js";

export async function runGitHubSASTModule(ctx: ScanContext): Promise<FindingInput[]> {
  const findings: FindingInput[] = [];
  const { scanId, addLog, safeFetch, projectData } = ctx;

  if (!projectData || !projectData.githubRepo) {
    return [];
  }

  const repo = projectData.githubRepo;
  const branch = projectData.githubBranch || "main";
  const token = projectData.githubToken;

  await addLog(scanId, "INFO", `[GitHub] Initiating Static Analysis on ${repo} (${branch})...`);

  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "RedForge-Security-Scanner",
  };
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }

  // 1. Secret Scanning & Sensitive File Detection
  // We'll check for files that should never be in git
  const sensitiveFiles = [
    { path: ".env", category: "Environment Credentials" },
    { path: "id_rsa", category: "SSH Private Key" },
    { path: "service-account.json", category: "GCP Service Account" },
    { path: "config/database.yml", category: "Rails DB Config" },
    { path: "web.config", category: "IIS Config" }
  ];
  
  for (const file of sensitiveFiles) {
    try {
      const url = `https://api.github.com/repos/${repo}/contents/${file.path}?ref=${branch}`;
      const resp = await safeFetch(url, { headers });
      
      if (resp && resp.status === 200) {
        const data = await resp.json();
        // If it's a file (not a directory)
        if (data.type === "file") {
          findings.push({
            title: `Sensitive file exposed in repository: ${file.path}`,
            description: `The file '${file.path}' (${file.category}) was found in the public or linked repository. This file type often contains plain-text credentials and should be excluded via .gitignore.`,
            endpoint: `github://${repo}/${file.path}`,
            severity: "HIGH",
            cvss: "7.8",
            cwe: "CWE-522",
            owasp: "A01",
            tags: ["github", "sast", "leaked-credentials"],
            compliance: {
              gdpr: "Art. 32 – Security of processing",
              iso27001: "A.14.2 – System security"
            },
            fixExplanation: `Remove the file from git history immediately (using 'git filter-repo' or BFG Repo-Cleaner) and add it to .gitignore. Rotation of any keys inside is mandatory.`,
          });
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  // 2. Probing for hardcoded secrets in common source files
  const sourceChecks = ["src/index.js", "src/main.ts", "lib/config.js", "app.py", "main.go"];
  for (const path of sourceChecks) {
    try {
      const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
      const resp = await safeFetch(url, { headers });
      if (resp && resp.status === 200) {
        const data = await resp.json();
        if (data.type === "file" && data.content) {
          const content = Buffer.from(data.content, "base64").toString("utf8");
          
          // AWS Access Key Pattern
          if (content.match(/AKIA[0-9A-Z]{16}/)) {
            findings.push({
              title: `Hardcoded AWS Access Key in ${path}`,
              description: `An AWS Access Key ID (AKIA...) was found hardcoded in the source file. Attackers can use this to probe your AWS account permissions.`,
              endpoint: `github://${repo}/${path}`,
              severity: "CRITICAL",
              cvss: "9.1",
              cwe: "CWE-798",
              owasp: "A07",
              tags: ["github", "sast", "aws-key"],
              remediationCode: [
                { language: "javascript", label: "Use Env Vars", code: `const accessKey = process.env.AWS_ACCESS_KEY_ID;` }
              ],
              fixExplanation: "Revoke the key in the AWS Console and replace with IAM roles or environment variables.",
            });
          }

          // Stripe Secret Key Pattern
          if (content.match(/sk_live_[0-9a-zA-Z]{24}/)) {
            findings.push({
              title: "Hardcoded Stripe Live Secret Key",
              description: "A production Stripe Secret Key was detected. This grants full access to your Stripe account, including refunds and customer data.",
              endpoint: `github://${repo}/${path}`,
              severity: "CRITICAL",
              cvss: "9.8",
              cwe: "CWE-798",
              owasp: "A07",
              tags: ["github", "sast", "stripe-key"],
              fixExplanation: "Roll the secret key in the Stripe Dashboard immediately.",
            });
          }
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  // 3. Dependency Check (package.json)
  try {
    const url = `https://api.github.com/repos/${repo}/contents/package.json?ref=${branch}`;
    const resp = await safeFetch(url, { headers });
    if (resp && resp.status === 200) {
      const data = await resp.json();
      const pkg = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      
      // Check for 'axios' < 0.21.1 (SSRF vulnerability)
      if (deps['axios'] && deps['axios'].match(/[\^~]?0\.(1|20)\./)) {
        findings.push({
          title: "Vulnerable dependency: axios < 0.21.1",
          description: `Repository uses ${deps['axios']}, which is vulnerable to Server-Side Request Forgery (SSRF).`,
          endpoint: `github://${repo}/package.json`,
          severity: "MEDIUM",
          cvss: "5.5",
          cwe: "CWE-918",
          owasp: "A10",
          tags: ["github", "sast", "dependencies"],
          fixExplanation: "Update axios to version 0.21.1 or higher.",
        });
      }
    }
  } catch (e) {
    // Ignore
  }

  await addLog(scanId, "INFO", `✓ GitHub SAST complete for ${repo}`);
  return findings;
}
