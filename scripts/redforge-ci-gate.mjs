#!/usr/bin/env node

const apiBase = process.env.REDFORGE_API_BASE;
const apiKey = process.env.REDFORGE_API_KEY;
const projectId = process.env.REDFORGE_PROJECT_ID;
const failOn = (process.env.REDFORGE_FAIL_ON || "CRITICAL").split(",").map((s) => s.trim()).filter(Boolean);
const maxScanAgeHours = Number(process.env.REDFORGE_MAX_SCAN_AGE_HOURS || "24");

if (!apiBase || !apiKey || !projectId) {
  console.error("Missing required env vars: REDFORGE_API_BASE, REDFORGE_API_KEY, REDFORGE_PROJECT_ID");
  process.exit(2);
}

const url = `${apiBase.replace(/\/+$/, "")}/api/ci/evaluate`;
const resp = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  },
  body: JSON.stringify({
    projectId,
    failOn,
    maxScanAgeHours,
    includeMarkdown: true,
  }),
});

if (!resp.ok) {
  const text = await resp.text();
  console.error(`RedForge gate request failed: HTTP ${resp.status} ${resp.statusText}`);
  console.error(text);
  process.exit(2);
}

const result = await resp.json();
if (result?.markdown) {
  console.log(result.markdown);
}

if (!result?.pass) {
  console.error(`\nRedForge gate failed: ${result?.gateReason || "blocking findings present"}`);
  process.exit(1);
}

console.log("\nRedForge gate passed.");
process.exit(0);

