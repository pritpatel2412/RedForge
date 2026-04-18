/**
 * Scan Diff Engine (#10)
 * Compares current scan findings against the previous scan to produce:
 * - New findings (regressions introduced)
 * - Resolved findings (fixed since last scan)
 * - Severity regressions (finding got worse)
 * - Fix rate over time
 */
import type { ScanDiff } from "./types.js";
import { db, findingsTable, scansTable } from "@workspace/db";
import { eq, and, lt, ne } from "drizzle-orm";

const SEV_RANK: Record<string, number> = {
  CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1,
};

export async function computeScanDiff(
  currentScanId: string,
  projectId: string,
  currentFindingTitles: string[],
  currentFindingSeverities: Record<string, string>
): Promise<ScanDiff> {
  try {
    // Find the most recent completed scan for the same project (not the current one)
    const previousScans = await db
      .select({ id: scansTable.id })
      .from(scansTable)
      .where(
        and(
          eq(scansTable.projectId, projectId),
          eq(scansTable.status, "COMPLETED"),
          ne(scansTable.id, currentScanId)
        )
      )
      .orderBy(scansTable.createdAt)
      .limit(1);

    if (!previousScans.length) {
      // First scan for this project — no diff possible
      return {
        newFindings: currentFindingTitles,
        resolvedFindings: [],
        regressions: [],
        fixRate: 0,
      };
    }

    const prevScanId = previousScans[0].id;
    const prevFindings = await db
      .select({ title: findingsTable.title, severity: findingsTable.severity })
      .from(findingsTable)
      .where(eq(findingsTable.scanId, prevScanId));

    const prevTitles = new Set(prevFindings.map(f => f.title));
    const prevSevMap: Record<string, string> = {};
    prevFindings.forEach(f => { prevSevMap[f.title] = f.severity; });

    const currentTitleSet = new Set(currentFindingTitles);

    // New findings = in current but NOT in previous
    const newFindings = currentFindingTitles.filter(t => !prevTitles.has(t));

    // Resolved findings = in previous but NOT in current
    const resolvedFindings = [...prevTitles].filter(t => !currentTitleSet.has(t));

    // Regressions = finding exists in both scans but severity got worse
    const regressions: string[] = [];
    for (const title of currentFindingTitles) {
      if (!prevTitles.has(title)) continue;
      const prevSev = SEV_RANK[prevSevMap[title]] || 0;
      const currSev = SEV_RANK[currentFindingSeverities[title]] || 0;
      if (currSev > prevSev) {
        regressions.push(`${title} (${prevSevMap[title]} → ${currentFindingSeverities[title]})`);
      }
    }

    // Fix rate = resolved / (previous total) * 100
    const prevTotal = prevTitles.size;
    const fixRate = prevTotal > 0 ? Math.round((resolvedFindings.length / prevTotal) * 100) : 0;

    return { newFindings, resolvedFindings, regressions, fixRate };
  } catch {
    // DB error or first scan — return safe defaults
    return {
      newFindings: currentFindingTitles,
      resolvedFindings: [],
      regressions: [],
      fixRate: 0,
    };
  }
}
