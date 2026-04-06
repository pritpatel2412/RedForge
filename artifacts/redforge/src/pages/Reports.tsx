import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Download, FileText, Filter, SlidersHorizontal, CheckSquare, Square, AlertTriangle } from "lucide-react";
import { useListFindings, useListProjects } from "@workspace/api-client-react";
import { SeverityBadge, FindingStatusBadge } from "@/components/Badges";
import CustomSelect from "@/components/CustomSelect";
import { formatDate } from "@/lib/utils";

const SEV_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
const SEV_COLOR: Record<string, [number, number, number]> = {
  CRITICAL: [239, 68, 68],
  HIGH:     [249, 115, 22],
  MEDIUM:   [245, 158, 11],
  LOW:      [34, 197, 94],
  INFO:     [99, 102, 241],
};

const ALL_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const ALL_STATUSES   = ["OPEN", "IN_PROGRESS", "FIXED", "WONT_FIX", "FALSE_POSITIVE"];
const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open", IN_PROGRESS: "In Progress", FIXED: "Fixed",
  WONT_FIX: "Won't Fix", FALSE_POSITIVE: "False Positive",
};
const SEV_DOT: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#f59e0b", LOW: "#22c55e", INFO: "#6366f1"
};

function MultiCheckbox({ label, dot, checked, onChange }: {
  label: string; dot?: string; checked: boolean; onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all border ${
        checked ? "bg-primary/10 border-primary/30 text-white" : "border-white/6 text-zinc-400 hover:border-white/15 hover:text-white"
      }`}
    >
      {checked
        ? <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
        : <Square className="w-3.5 h-3.5 shrink-0" />}
      {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />}
      <span>{label}</span>
    </button>
  );
}

async function generatePDF(findings: any[], filters: { severities: string[]; statuses: string[]; projectName: string }) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  // Portrait A4 — more professional for reports
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();   // 210
  const H = doc.internal.pageSize.getHeight();  // 297
  const pageCount = () => (doc as any).internal.getNumberOfPages();

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  // Compute stats
  const bySev: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  const bySt: Record<string, number> = { OPEN: 0, IN_PROGRESS: 0, FIXED: 0, WONT_FIX: 0, FALSE_POSITIVE: 0 };
  findings.forEach(f => {
    if (bySev[f.severity] !== undefined) bySev[f.severity]++;
    if (bySt[f.status] !== undefined) bySt[f.status]++;
  });
  const resolved = bySt.FIXED + bySt.WONT_FIX + bySt.FALSE_POSITIVE;
  const open     = bySt.OPEN + bySt.IN_PROGRESS;
  const fixRate  = findings.length ? Math.round((resolved / findings.length) * 100) : 0;
  const riskScore = Math.min(10, +(
    (bySev.CRITICAL * 4 + bySev.HIGH * 2.5 + bySev.MEDIUM * 1 + bySev.LOW * 0.3) / Math.max(findings.length, 1)
  ).toFixed(1));
  const riskLabel = riskScore >= 7 ? "CRITICAL" : riskScore >= 4 ? "HIGH" : riskScore >= 2 ? "MEDIUM" : "LOW";
  const riskColor: [number,number,number] = riskScore >= 7 ? [239,68,68] : riskScore >= 4 ? [249,115,22] : riskScore >= 2 ? [245,158,11] : [34,197,94];

  // ── Shared helpers ─────────────────────────────────────────────────────────
  const drawPageChrome = (pageNum: number) => {
    doc.setPage(pageNum);
    // Top bar
    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, W, 14, "F");
    doc.setFillColor(239, 68, 68);
    doc.rect(0, 0, 2, 14, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(239, 68, 68);
    doc.text("REDFORGE", 6, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("Security Intelligence Platform", 34, 9);
    doc.text(`${dateStr}  ${timeStr}`, W - 8, 9, { align: "right" });
    // Bottom bar
    doc.setFillColor(15, 15, 15);
    doc.rect(0, H - 12, W, 12, "F");
    doc.setFillColor(239, 68, 68);
    doc.rect(0, H - 12, 2, 12, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text("CONFIDENTIAL — For authorized recipients only", 6, H - 5);
    doc.text(`Page ${pageNum}`, W - 8, H - 5, { align: "right" });
  };

  const drawSectionLabel = (y: number, text: string) => {
    doc.setFillColor(239, 68, 68);
    doc.rect(8, y, 2, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(239, 68, 68);
    doc.text(text.toUpperCase(), 13, y + 3.8);
  };

  const drawStatBox = (x: number, y: number, w: number, h: number, value: string, label: string, color: [number,number,number]) => {
    doc.setFillColor(20, 20, 20);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, "F");
    doc.setDrawColor(...color);
    doc.setLineWidth(0.6);
    doc.line(x, y, x + w, y);
    doc.setLineWidth(0.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...color);
    doc.text(value, x + w / 2, y + h * 0.55, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(label, x + w / 2, y + h - 4, { align: "center" });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ══════════════════════════════════════════════════════════════════════════
  // Full dark background
  doc.setFillColor(8, 8, 8);
  doc.rect(0, 0, W, H, "F");

  // Red accent bar on left
  doc.setFillColor(239, 68, 68);
  doc.rect(0, 0, 5, H, "F");

  // Brand wordmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(239, 68, 68);
  doc.text("RedForge", 18, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text("Security Intelligence Platform", 18, 57);

  // Separator line
  doc.setDrawColor(35, 35, 35);
  doc.setLineWidth(0.5);
  doc.line(18, 63, W - 15, 63);

  // Report title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(240, 240, 240);
  doc.text("SECURITY FINDINGS", 18, 82);
  doc.text("REPORT", 18, 95);

  // Classification banner
  doc.setFillColor(239, 68, 68);
  doc.roundedRect(18, 103, 45, 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("CONFIDENTIAL", 40.5, 108.5, { align: "center" });

  // Risk posture card
  const riskCardY = 125;
  doc.setFillColor(20, 20, 20);
  doc.roundedRect(18, riskCardY, 80, 42, 3, 3, "F");
  doc.setDrawColor(...riskColor);
  doc.setLineWidth(0.8);
  doc.line(18, riskCardY, 98, riskCardY);
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("OVERALL RISK POSTURE", 58, riskCardY + 9, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...riskColor);
  doc.text(riskLabel, 58, riskCardY + 26, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Risk Score: ${riskScore}/10`, 58, riskCardY + 36, { align: "center" });

  // Summary metrics (right of risk card)
  const metaX = 108;
  const metaItems = [
    { label: "Total Findings",    value: String(findings.length) },
    { label: "Critical / High",   value: `${bySev.CRITICAL} / ${bySev.HIGH}` },
    { label: "Open Issues",       value: String(open) },
    { label: "Fix Rate",          value: `${fixRate}%` },
    { label: "Project Scope",     value: filters.projectName || "All Projects" },
  ];
  metaItems.forEach((m, i) => {
    const my = riskCardY + 4 + i * 9;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(m.label, metaX, my);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(210, 210, 210);
    doc.text(m.value, W - 15, my, { align: "right" });
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.2);
    if (i < metaItems.length - 1) doc.line(metaX, my + 2.5, W - 15, my + 2.5);
  });

  // Severity visual breakdown (bottom of cover)
  const sevY = 185;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("SEVERITY DISTRIBUTION", 18, sevY);

  const sevBars = ALL_SEVERITIES.map(s => ({ s, n: bySev[s] || 0, c: SEV_COLOR[s] }));
  const maxSev = Math.max(...sevBars.map(b => b.n), 1);
  const barAreaW = W - 36;
  sevBars.forEach((b, i) => {
    const bx = 18;
    const by = sevY + 5 + i * 12;
    const barW = Math.max((b.n / maxSev) * (barAreaW - 50), b.n > 0 ? 4 : 0);
    // Label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(b.s, bx, by + 5.5);
    // Track
    doc.setFillColor(25, 25, 25);
    doc.roundedRect(bx + 28, by + 1, barAreaW - 50, 8, 1.5, 1.5, "F");
    // Bar
    if (b.n > 0) {
      const [r, g, bl] = b.c;
      doc.setFillColor(r, g, bl);
      doc.roundedRect(bx + 28, by + 1, barW, 8, 1.5, 1.5, "F");
    }
    // Count
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(String(b.n), W - 15, by + 7, { align: "right" });
  });

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(50, 50, 50);
  doc.text(`Generated: ${dateStr} at ${timeStr}`, 18, H - 16);
  doc.text("CONFIDENTIAL — For authorized recipients only", W - 15, H - 16, { align: "right" });
  doc.setDrawColor(30, 30, 30);
  doc.line(18, H - 20, W - 15, H - 20);

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — EXECUTIVE SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageChrome(2);

  let y = 24;
  drawSectionLabel(y, "01 — Executive Summary");
  y += 11;

  // Intro paragraph
  const critText = bySev.CRITICAL > 0
    ? `This report identifies ${bySev.CRITICAL} critical vulnerabilit${bySev.CRITICAL > 1 ? "ies" : "y"} requiring immediate attention.`
    : "No critical vulnerabilities were identified in this scan period.";
  const summaryText = `This security assessment covers ${findings.length} finding${findings.length !== 1 ? "s" : ""} across the specified scope. ${critText} The overall risk posture is rated ${riskLabel} with a composite score of ${riskScore}/10. A total of ${open} issue${open !== 1 ? "s" : ""} remain open and ${resolved} ${resolved !== 1 ? "have" : "has"} been resolved (fix rate: ${fixRate}%).`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(160, 160, 160);
  const lines = doc.splitTextToSize(summaryText, W - 26);
  doc.text(lines, 12, y);
  y += lines.length * 5 + 4;

  // 6 stat boxes — 2 rows × 3
  const boxW = (W - 24 - 10) / 3;
  const boxH = 24;
  const statBoxes: { val: string; label: string; color: [number,number,number] }[] = [
    { val: String(findings.length),  label: "Total Findings",    color: [160, 160, 160] },
    { val: String(bySev.CRITICAL),   label: "Critical",          color: [239, 68, 68] },
    { val: String(bySev.HIGH),       label: "High",              color: [249, 115, 22] },
    { val: String(open),             label: "Open / In Progress", color: [245, 158, 11] },
    { val: String(resolved),         label: "Resolved",           color: [34, 197, 94] },
    { val: `${fixRate}%`,            label: "Fix Rate",           color: fixRate >= 75 ? [34,197,94] : fixRate >= 40 ? [245,158,11] : [239,68,68] },
  ];
  statBoxes.forEach((b, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    drawStatBox(12 + col * (boxW + 5), y + row * (boxH + 5), boxW, boxH, b.val, b.label, b.color);
  });
  y += 2 * (boxH + 5) + 6;

  // Severity bar chart — horizontal
  drawSectionLabel(y, "02 — Findings by Severity");
  y += 11;

  const chartTrackW = W - 80;
  ALL_SEVERITIES.forEach((s, i) => {
    const count = bySev[s] || 0;
    const barW2 = count > 0 ? Math.max((count / Math.max(Math.max(...Object.values(bySev)), 1)) * chartTrackW, 6) : 0;
    const [r, g, b] = SEV_COLOR[s];
    const by2 = y + i * 11;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.text(s, 12, by2 + 5.5);
    // Track
    doc.setFillColor(22, 22, 22);
    doc.roundedRect(45, by2, chartTrackW, 8, 1.5, 1.5, "F");
    // Fill
    if (count > 0) {
      doc.setFillColor(r, g, b);
      doc.roundedRect(45, by2, barW2, 8, 1.5, 1.5, "F");
    }
    // Count label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(count > 0 ? 220 : 60, count > 0 ? 220 : 60, count > 0 ? 220 : 60);
    doc.text(String(count), 45 + chartTrackW + 6, by2 + 5.8);
  });
  y += ALL_SEVERITIES.length * 11 + 6;

  // Status breakdown — horizontal pill bars
  drawSectionLabel(y, "03 — Status Breakdown");
  y += 11;

  const statusItems = [
    { label: "Open",             count: bySt.OPEN,             color: [245, 158, 11] as [number,number,number] },
    { label: "In Progress",      count: bySt.IN_PROGRESS,      color: [99, 102, 241] as [number,number,number] },
    { label: "Fixed",            count: bySt.FIXED,            color: [34, 197, 94] as [number,number,number] },
    { label: "Won't Fix",        count: bySt.WONT_FIX,         color: [100, 100, 100] as [number,number,number] },
    { label: "False Positive",   count: bySt.FALSE_POSITIVE,   color: [80, 80, 80] as [number,number,number] },
  ];
  const totalStatus = findings.length || 1;
  statusItems.forEach((st, i) => {
    const pct = Math.round((st.count / totalStatus) * 100);
    const bw = (st.count / totalStatus) * chartTrackW;
    const sy = y + i * 11;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.text(st.label, 12, sy + 5.5);
    doc.setFillColor(22, 22, 22);
    doc.roundedRect(45, sy, chartTrackW, 8, 1.5, 1.5, "F");
    if (st.count > 0) {
      const [r, g, b] = st.color;
      doc.setFillColor(r, g, b);
      doc.roundedRect(45, sy, Math.max(bw, 4), 8, 1.5, 1.5, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`${st.count}  (${pct}%)`, 45 + chartTrackW + 6, sy + 5.8);
  });
  y += statusItems.length * 11 + 8;

  // Top 5 critical / high findings summary
  const topFindings = findings
    .filter(f => f.severity === "CRITICAL" || f.severity === "HIGH")
    .slice(0, 5);
  if (topFindings.length > 0) {
    drawSectionLabel(y, "04 — Top Priority Findings");
    y += 11;
    topFindings.forEach((f, i) => {
      const [r, g, b] = SEV_COLOR[f.severity] || [160, 160, 160];
      // Row bg
      doc.setFillColor(i % 2 === 0 ? 18 : 22, i % 2 === 0 ? 18 : 22, i % 2 === 0 ? 18 : 22);
      doc.roundedRect(12, y, W - 24, 11, 1.5, 1.5, "F");
      // Severity pill
      doc.setFillColor(r, g, b);
      doc.roundedRect(14, y + 2, 20, 7, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(255, 255, 255);
      doc.text(f.severity, 24, y + 7, { align: "center" });
      // Title
      const title = (f.title || "Untitled").length > 60 ? (f.title || "").slice(0, 58) + "…" : (f.title || "Untitled");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(220, 220, 220);
      doc.text(title, 38, y + 6);
      // CVSS
      if (f.cvss) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(r, g, b);
        doc.text(`CVSS ${f.cvss}`, W - 14, y + 6, { align: "right" });
      }
      y += 12;
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 3+ — FINDINGS TABLE
  // ══════════════════════════════════════════════════════════════════════════
  autoTable(doc, {
    startY: 22,
    head: [["#", "Severity", "Title", "Status", "CVSS", "OWASP / CWE", "Discovered"]],
    body: findings.map((f, i) => [
      String(i + 1),
      f.severity || "—",
      f.title || "—",
      STATUS_LABELS[f.status] || f.status || "—",
      f.cvss != null ? String(f.cvss) : "—",
      [f.owasp, f.cwe].filter(Boolean).join(" · ") || "—",
      f.createdAt ? new Date(f.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
    ]),
    styles: {
      fontSize: 7.5, cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      textColor: [210, 210, 210], fillColor: [14, 14, 14],
      lineColor: [28, 28, 28], lineWidth: 0.25, font: "helvetica",
    },
    headStyles: {
      fillColor: [20, 20, 20], textColor: [239, 68, 68],
      fontStyle: "bold", fontSize: 7.5, cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: [19, 19, 19] },
    columnStyles: {
      0: { cellWidth: 9, halign: "center", textColor: [70, 70, 70] },
      1: { cellWidth: 22, halign: "center", fontStyle: "bold" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 24, halign: "center" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 34 },
      6: { cellWidth: 26, halign: "center" },
    },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 1) {
        const sev = data.cell.raw as string;
        const [r, g, b] = SEV_COLOR[sev] || [120, 120, 120];
        data.cell.styles.textColor = [r, g, b];
        data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "body" && data.column.index === 3) {
        const st = data.cell.raw as string;
        if (st === "Open") data.cell.styles.textColor = [245, 158, 11];
        else if (st === "Fixed") data.cell.styles.textColor = [34, 197, 94];
        else if (st === "In Progress") data.cell.styles.textColor = [99, 102, 241];
        else data.cell.styles.textColor = [100, 100, 100];
      }
      if (data.section === "body" && data.column.index === 4) {
        const cvss = parseFloat(data.cell.raw as string);
        if (cvss >= 9)       data.cell.styles.textColor = [239, 68, 68];
        else if (cvss >= 7)  data.cell.styles.textColor = [249, 115, 22];
        else if (cvss >= 4)  data.cell.styles.textColor = [245, 158, 11];
        else if (!isNaN(cvss)) data.cell.styles.textColor = [34, 197, 94];
      }
    },
    didDrawPage: () => {
      const pn = (doc as any).internal.getCurrentPageInfo().pageNumber;
      drawPageChrome(pn);
      // Section label on first table page
      if (pn === 3) {
        doc.setPage(pn);
        drawSectionLabel(15, `05 — All Findings  (${findings.length} total)`);
      }
    },
    addPageContent: () => {},
    margin: { top: 22, bottom: 16, left: 12, right: 12 },
    pageBreak: "auto",
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE(S) — CRITICAL FINDING DETAIL CARDS
  // ══════════════════════════════════════════════════════════════════════════
  const criticals = findings.filter(f => f.severity === "CRITICAL" || f.severity === "HIGH").slice(0, 12);
  if (criticals.length > 0) {
    doc.addPage();
    const cpn = pageCount();
    drawPageChrome(cpn);
    drawSectionLabel(17, "06 — Critical & High Finding Details");

    let cy = 28;
    for (let i = 0; i < criticals.length; i++) {
      const f = criticals[i];
      const [r, g, b] = SEV_COLOR[f.severity] || [160, 160, 160];

      // Estimate card height
      const desc = f.description || f.remediation || "";
      const descLines = doc.splitTextToSize(desc.slice(0, 300), W - 52);
      const cardH = 10 + 8 + (descLines.length > 0 ? descLines.length * 3.8 + 4 : 0) + 8;

      if (cy + cardH > H - 20) {
        doc.addPage();
        const npn = pageCount();
        drawPageChrome(npn);
        cy = 22;
      }

      // Card background
      doc.setFillColor(18, 18, 18);
      doc.roundedRect(12, cy, W - 24, cardH, 2, 2, "F");
      // Left accent bar colored by severity
      doc.setFillColor(r, g, b);
      doc.roundedRect(12, cy, 3, cardH, 1, 1, "F");

      // Severity pill + title
      const pillW = f.severity.length * 2.4 + 6;
      doc.setFillColor(r, g, b);
      doc.roundedRect(18, cy + 4, pillW, 7, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(255, 255, 255);
      doc.text(f.severity, 18 + pillW / 2, cy + 9, { align: "center" });

      // Title
      const titleText = (f.title || "Untitled").length > 70 ? (f.title || "").slice(0, 68) + "…" : (f.title || "Untitled");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(230, 230, 230);
      doc.text(titleText, 18 + pillW + 4, cy + 9);

      // Meta row
      const metas: string[] = [];
      if (f.endpoint) metas.push(`Endpoint: ${f.endpoint.length > 45 ? f.endpoint.slice(0, 43) + "…" : f.endpoint}`);
      if (f.cvss != null) metas.push(`CVSS: ${f.cvss}`);
      if (f.owasp) metas.push(f.owasp);
      if (f.cwe) metas.push(f.cwe);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      doc.text(metas.join("   ·   "), 18, cy + 19);

      // Description / Remediation
      if (desc) {
        doc.setDrawColor(32, 32, 32);
        doc.line(18, cy + 22, W - 14, cy + 22);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(140, 140, 140);
        doc.text(descLines, 18, cy + 28);
      }

      cy += cardH + 5;
    }
  }

  // Apply chrome to all pages (cover has its own style, skip it)
  const total = pageCount();
  for (let p = 2; p <= total; p++) drawPageChrome(p);

  doc.save(`redforge-security-report-${now.toISOString().slice(0, 10)}.pdf`);
}

export default function Reports() {
  const [selSeverities, setSelSeverities] = useState<string[]>([...ALL_SEVERITIES]);
  const [selStatuses,   setSelStatuses]   = useState<string[]>(["OPEN", "IN_PROGRESS"]);
  const [projectId, setProjectId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [sortBy,   setSortBy]   = useState("severity");
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: findings = [] } = useListFindings({} as any);
  const { data: projects = [] } = useListProjects();

  const findingsArr: any[] = Array.isArray(findings) ? findings : (findings as any)?.findings ?? [];
  const projectsArr: any[] = Array.isArray(projects) ? projects : (projects as any)?.projects ?? [];

  const projectOptions = [
    { value: "", label: "All Projects" },
    ...projectsArr.map((p: any) => ({ value: p.id, label: p.name })),
  ];

  const toggleSev = (s: string) =>
    setSelSeverities(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleSt = (s: string) =>
    setSelStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const filtered = useMemo(() => {
    let arr = findingsArr.filter(f => {
      if (!selSeverities.includes(f.severity)) return false;
      if (!selStatuses.includes(f.status)) return false;
      if (projectId && f.projectId !== projectId) return false;
      if (dateFrom && new Date(f.createdAt) < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo); to.setDate(to.getDate() + 1);
        if (new Date(f.createdAt) > to) return false;
      }
      return true;
    });
    if (sortBy === "severity") arr = arr.sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
    else if (sortBy === "date_desc") arr = arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sortBy === "cvss") arr = arr.sort((a, b) => (b.cvss || 0) - (a.cvss || 0));
    return arr;
  }, [findingsArr, selSeverities, selStatuses, projectId, dateFrom, dateTo, sortBy]);

  const handleDownload = async () => {
    if (filtered.length === 0) return;
    setIsGenerating(true);
    try {
      const projectName = projectsArr.find((p: any) => p.id === projectId)?.name || "";
      await generatePDF(filtered, { severities: selSeverities, statuses: selStatuses, projectName });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-12"
    >
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure filters and download a PDF security report</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FILTER PANEL */}
        <div className="lg:col-span-1 space-y-5">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              Filters
            </div>

            {/* Severity */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Severity</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SEVERITIES.map(s => (
                  <MultiCheckbox
                    key={s}
                    label={s.charAt(0) + s.slice(1).toLowerCase()}
                    dot={SEV_DOT[s]}
                    checked={selSeverities.includes(s)}
                    onChange={() => toggleSev(s)}
                  />
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setSelSeverities([...ALL_SEVERITIES])} className="text-xs text-primary hover:underline">Select all</button>
                <span className="text-zinc-700">·</span>
                <button onClick={() => setSelSeverities([])} className="text-xs text-zinc-500 hover:text-white">Clear</button>
              </div>
            </div>

            {/* Status */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_STATUSES.map(s => (
                  <MultiCheckbox
                    key={s}
                    label={STATUS_LABELS[s]}
                    checked={selStatuses.includes(s)}
                    onChange={() => toggleSt(s)}
                  />
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setSelStatuses([...ALL_STATUSES])} className="text-xs text-primary hover:underline">Select all</button>
                <span className="text-zinc-700">·</span>
                <button onClick={() => setSelStatuses([])} className="text-xs text-zinc-500 hover:text-white">Clear</button>
              </div>
            </div>

            {/* Project */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Project</p>
              <CustomSelect
                value={projectId}
                onChange={setProjectId}
                options={projectOptions}
                className="w-full"
              />
            </div>

            {/* Date Range */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Date Range</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-zinc-500 mb-1 block">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full rounded-xl bg-zinc-900 border border-white/10 text-white text-xs px-3 py-2 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-zinc-500 mb-1 block">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full rounded-xl bg-zinc-900 border border-white/10 text-white text-xs px-3 py-2 focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-zinc-500 hover:text-white mt-1.5">
                  Clear dates
                </button>
              )}
            </div>

            {/* Sort */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Sort By</p>
              <CustomSelect
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: "severity",  label: "Severity (Critical first)" },
                  { value: "date_desc", label: "Date (Newest first)" },
                  { value: "cvss",      label: "CVSS Score (Highest first)" },
                ]}
                className="w-full"
              />
            </div>
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={filtered.length === 0 || isGenerating}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(239,68,68,0.35)] hover:shadow-[0_0_28px_rgba(239,68,68,0.5)]"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Generating PDF…
              </span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download PDF Report
                <span className="ml-1 bg-white/15 px-2 py-0.5 rounded-full text-xs font-bold">
                  {filtered.length}
                </span>
              </>
            )}
          </button>

          {filtered.length === 0 && selSeverities.length > 0 && (
            <p className="text-center text-xs text-zinc-500">No findings match your filters</p>
          )}
        </div>

        {/* PREVIEW PANEL */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-white">Report Preview</span>
              </div>
              <span className="text-xs text-muted-foreground">{filtered.length} findings matched</span>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                <AlertTriangle className="w-10 h-10 text-zinc-700 mb-3" />
                <p className="text-zinc-500 text-sm">No findings match the current filters.</p>
                <p className="text-zinc-600 text-xs mt-1">Adjust severity or status filters to include more results.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border" style={{ background: "oklch(7% 0 0)" }}>
                      <th className="text-left px-4 py-3 text-muted-foreground font-semibold">#</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Title</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Severity</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Status</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-semibold">CVSS</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Discovered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 50).map((f: any, i: number) => (
                      <motion.tr
                        key={f.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-border/50 hover:bg-white/2 transition-colors"
                      >
                        <td className="px-4 py-3 text-zinc-600 font-mono">{i + 1}</td>
                        <td className="px-4 py-3 text-white font-medium max-w-[220px]">
                          <span className="block truncate">{f.title}</span>
                          <span className="text-zinc-500 text-[10px] font-mono block truncate">{f.endpoint}</span>
                        </td>
                        <td className="px-4 py-3"><SeverityBadge severity={f.severity} /></td>
                        <td className="px-4 py-3"><FindingStatusBadge status={f.status} /></td>
                        <td className="px-4 py-3 text-zinc-300 font-mono">{f.cvss ?? "—"}</td>
                        <td className="px-4 py-3 text-zinc-400">{formatDate(f.createdAt)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > 50 && (
                  <div className="px-4 py-3 text-center text-xs text-zinc-500 border-t border-border">
                    Showing 50 of {filtered.length} — all {filtered.length} will be included in the PDF
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PDF Preview info card */}
          <div className="mt-4 rounded-xl border border-white/6 p-4 flex items-start gap-3" style={{ background: "oklch(7% 0 0)" }}>
            <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-white mb-1">What's in the PDF</p>
              <ul className="text-xs text-zinc-400 space-y-0.5">
                <li>· <span className="text-white font-medium">Cover page</span> — risk posture badge, severity distribution, key metrics</li>
                <li>· <span className="text-white font-medium">Executive Summary</span> — stat boxes, horizontal bar charts, top priority findings</li>
                <li>· <span className="text-white font-medium">Full findings table</span> — severity, status &amp; CVSS color-coded, OWASP / CWE, date</li>
                <li>· <span className="text-white font-medium">Critical &amp; High detail cards</span> — endpoint, description, remediation notes</li>
                <li>· Portrait A4 · CONFIDENTIAL header / footer on every page</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
