interface SlackBlock {
  type: string;
  [key: string]: unknown;
}

interface SlackMessage {
  blocks: SlackBlock[];
  text: string;
}

async function sendSlackMessage(webhookUrl: string, message: SlackMessage): Promise<void> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    if (!res.ok) {
      console.error(`Slack webhook failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("Failed to send Slack notification:", err);
  }
}

export async function sendScanComplete(
  scan: { id: string; findingsCount: number; criticalCount: number; highCount: number },
  projectName: string,
  appUrl: string,
  webhookUrl: string
): Promise<void> {
  const message: SlackMessage = {
    text: `RedForge scan complete for ${projectName} — ${scan.findingsCount} findings`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: scan.criticalCount > 0 ? "🔴 RedForge: Scan Complete — Critical Issues Found" : "✅ RedForge: Scan Complete",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Project:* ${projectName}\n*Scan ID:* ${scan.id.slice(0, 8)}...`,
        },
        fields: [
          { type: "mrkdwn", text: `*Total Findings*\n${scan.findingsCount}` },
          { type: "mrkdwn", text: `*Critical Issues*\n${scan.criticalCount > 0 ? `🔴 ${scan.criticalCount}` : "✅ 0"}` },
          { type: "mrkdwn", text: `*High Issues*\n${scan.highCount > 0 ? `🟠 ${scan.highCount}` : "0"}` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Scan Results", emoji: true },
            url: `${appUrl}/scans/${scan.id}`,
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "View All Findings", emoji: true },
            url: `${appUrl}/findings`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Scan ID: \`${scan.id}\` • Completed at ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };

  await sendSlackMessage(webhookUrl, message);
}

export async function sendCriticalFinding(
  finding: {
    id: string;
    title: string;
    endpoint: string;
    description?: string | null;
    cvss?: string | null;
    cwe?: string | null;
    owasp?: string | null;
    cves?: string[] | null;
  },
  projectName: string,
  appUrl: string,
  webhookUrl: string
): Promise<void> {
  const message: SlackMessage = {
    text: `🔴 Critical vulnerability detected: ${finding.title}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🔴 RedForge: New Critical Finding",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${finding.title}*\n*Project:* ${projectName}\n*Endpoint:* \`${finding.endpoint}\`${finding.description ? `\n\n> ${finding.description}` : ""}`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Severity*\n🔴 CRITICAL` },
          { type: "mrkdwn", text: `*CVSS Score*\n${finding.cvss || "N/A"}` },
          { type: "mrkdwn", text: `*OWASP Top 10*\n${finding.owasp || "N/A"}` },
          { type: "mrkdwn", text: `*CWE*\n${finding.cwe || "N/A"}` },
        ],
      },
      ...(finding.cves && finding.cves.length > 0 ? [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Associated CVEs:* ${finding.cves.map(c => `\`${c}\``).join(", ")}`
        }
      }] : []),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Finding", emoji: true },
            url: `${appUrl}/findings/${finding.id}`,
            style: "danger",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Apply AI Fix", emoji: true },
            url: `${appUrl}/findings/${finding.id}`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Finding ID: \`${finding.id}\` • Detected at ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };

  await sendSlackMessage(webhookUrl, message);
}

export async function sendTestMessage(webhookUrl: string): Promise<void> {
  const message: SlackMessage = {
    text: "🚀 RedForge: Slack Integration Test",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🚀 RedForge: Connectivity Test",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "If you are reading this, your *RedForge Slack Integration* is successfully configured and ready to receive critical vulnerability alerts.",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Test triggered at ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };

  await sendSlackMessage(webhookUrl, message);
}
