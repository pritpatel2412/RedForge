import {
  db,
  projectsTable,
  scansTable,
  findingsTable,
  scanLogsTable,
  workspaceMembersTable,
  scanAutopilotTable,
} from "@workspace/db";
import { and, asc, desc, eq, lte, ne } from "drizzle-orm";
import { runRealScan } from "./scanner/index.js";
import { createNotification } from "./notifications/create.js";
import { isAtLeastPlan } from "./plan.js";

type Frequency = "DAILY" | "WEEKLY";
type ScanMode = "PASSIVE" | "ACTIVE";

const SCHEDULER_INTERVAL_MS = Number(process.env.AUTOPILOT_SCHEDULER_INTERVAL_MS || 30_000);
const WORKER_INTERVAL_MS = Number(process.env.AUTOPILOT_WORKER_INTERVAL_MS || 5_000);
const MAX_CONCURRENCY = Math.max(1, Number(process.env.AUTOPILOT_MAX_CONCURRENCY || 1));

let bootstrapped = false;
let schedulerTimer: NodeJS.Timeout | null = null;
let workerTimer: NodeJS.Timeout | null = null;
let workerInFlight = 0;

function clampHour(hourUtc: number): number {
  return Math.max(0, Math.min(23, Math.floor(hourUtc)));
}

function clampDay(dayOfWeek: number): number {
  return Math.max(0, Math.min(6, Math.floor(dayOfWeek)));
}

function nextDaily(base: Date, hourUtc: number): Date {
  const h = clampHour(hourUtc);
  const out = new Date(base);
  out.setUTCMinutes(0, 0, 0);
  out.setUTCHours(h);
  if (out <= base) out.setUTCDate(out.getUTCDate() + 1);
  return out;
}

function nextWeekly(base: Date, dayOfWeek: number, hourUtc: number): Date {
  const d = clampDay(dayOfWeek);
  const h = clampHour(hourUtc);
  const out = new Date(base);
  out.setUTCMinutes(0, 0, 0);
  out.setUTCHours(h);
  const currentDay = out.getUTCDay();
  let delta = d - currentDay;
  if (delta < 0) delta += 7;
  out.setUTCDate(out.getUTCDate() + delta);
  if (out <= base) out.setUTCDate(out.getUTCDate() + 7);
  return out;
}

export function computeNextRunAt(
  frequency: Frequency,
  hourUtc: number,
  dayOfWeek: number,
  now: Date = new Date(),
): Date {
  if (frequency === "WEEKLY") return nextWeekly(now, dayOfWeek, hourUtc);
  return nextDaily(now, hourUtc);
}

async function notifyWorkspace(
  projectId: string,
  title: string,
  body: string,
  link?: string,
  type: "info" | "success" | "warning" | "error" = "info",
) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) return;
  const members = await db.select().from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.workspaceId as any, project.workspaceId));
  for (const member of members) {
    createNotification({
      userId: member.userId,
      workspaceId: project.workspaceId,
      title,
      body,
      link: link || null,
      type,
    }).catch(() => {});
  }
}

async function scheduleDueRuns() {
  const now = new Date();
  const due = await db.select().from(scanAutopilotTable)
    .where(and(
      eq(scanAutopilotTable.enabled, true),
      lte(scanAutopilotTable.nextRunAt, now),
    ));

  for (const cfg of due) {
    const [project] = await db.select().from(projectsTable)
      .where(eq(projectsTable.id, cfg.projectId))
      .limit(1);
    if (!project || project.status !== "active") continue;

    const [active] = await db.select({ id: scansTable.id }).from(scansTable).where(and(
      eq(scansTable.projectId, cfg.projectId),
      eq(scansTable.status, "RUNNING"),
    )).limit(1);
    const [pending] = await db.select({ id: scansTable.id }).from(scansTable).where(and(
      eq(scansTable.projectId, cfg.projectId),
      eq(scansTable.status, "PENDING"),
      eq(scansTable.scanMode, "CONTINUOUS"),
    )).limit(1);

    const nextRunAt = computeNextRunAt(
      (cfg.frequency as Frequency) || "DAILY",
      cfg.hourUtc ?? 2,
      cfg.dayOfWeek ?? 1,
      now,
    );

    if (!active && !pending) {
      await db.insert(scansTable).values({
        projectId: cfg.projectId,
        status: "PENDING",
        scanMode: "CONTINUOUS",
      });
    }

    await db.update(scanAutopilotTable).set({
      nextRunAt,
      updatedAt: new Date(),
    }).where(eq(scanAutopilotTable.id, cfg.id));
  }
}

async function processQueue() {
  if (workerInFlight >= MAX_CONCURRENCY) return;
  const slots = MAX_CONCURRENCY - workerInFlight;
  if (slots <= 0) return;

  const pending = await db.select({
    id: scansTable.id,
    projectId: scansTable.projectId,
    scanMode: scansTable.scanMode,
    targetUrl: projectsTable.targetUrl,
    autopilotScanMode: scanAutopilotTable.scanMode,
  })
    .from(scansTable)
    .innerJoin(projectsTable, eq(scansTable.projectId, projectsTable.id))
    .leftJoin(scanAutopilotTable, eq(scanAutopilotTable.projectId, scansTable.projectId))
    .where(and(
      eq(scansTable.status, "PENDING"),
      eq(scansTable.scanMode, "CONTINUOUS"),
    ))
    .orderBy(asc(scansTable.createdAt))
    .limit(slots);

  for (const row of pending) {
    const [running] = await db.select({ id: scansTable.id }).from(scansTable).where(and(
      eq(scansTable.projectId, row.projectId),
      eq(scansTable.status, "RUNNING"),
    )).limit(1);
    if (running) continue;

    workerInFlight += 1;
    const effectiveMode = row.autopilotScanMode === "ACTIVE" ? "ACTIVE" : "PASSIVE";
    runRealScan(row.id, row.targetUrl, effectiveMode as any)
      .then(async () => {
        const [latestCompleted] = await db.select({ id: scansTable.id }).from(scansTable).where(and(
          eq(scansTable.projectId, row.projectId),
          eq(scansTable.status, "COMPLETED"),
        )).orderBy(desc(scansTable.createdAt)).limit(1);
        await db.update(scanAutopilotTable).set({
          lastRunAt: new Date(),
          lastScanId: latestCompleted?.id || null,
          updatedAt: new Date(),
        }).where(eq(scanAutopilotTable.projectId, row.projectId));
      })
      .catch(() => {})
      .finally(() => {
        workerInFlight = Math.max(0, workerInFlight - 1);
      });
  }
}

export async function triggerOnDeployContinuousScan(projectId: string): Promise<{ queued: boolean; reason?: string }> {
  const [cfg] = await db.select().from(scanAutopilotTable)
    .where(and(eq(scanAutopilotTable.projectId, projectId), eq(scanAutopilotTable.enabled, true)))
    .limit(1);
  if (!cfg) return { queued: false, reason: "autopilot not configured" };
  if (!cfg.onDeploy) return { queued: false, reason: "on-deploy trigger disabled" };

  const [active] = await db.select({ id: scansTable.id }).from(scansTable).where(and(
    eq(scansTable.projectId, projectId),
    eq(scansTable.status, "RUNNING"),
  )).limit(1);
  const [pending] = await db.select({ id: scansTable.id }).from(scansTable).where(and(
    eq(scansTable.projectId, projectId),
    eq(scansTable.status, "PENDING"),
    eq(scansTable.scanMode, "CONTINUOUS"),
  )).limit(1);
  if (active || pending) return { queued: false, reason: "scan already running or queued" };

  await queueContinuousScan(projectId);
  await notifyWorkspace(
    projectId,
    "🚀 Continuous scan queued (deploy trigger)",
    "A deployment event queued a new continuous security scan.",
    undefined,
    "info",
  );
  return { queued: true };
}

export async function queueContinuousScan(projectId: string): Promise<{ queued: boolean; reason?: string }> {
  const [active] = await db.select({ id: scansTable.id }).from(scansTable).where(and(
    eq(scansTable.projectId, projectId),
    eq(scansTable.status, "RUNNING"),
  )).limit(1);
  const [pending] = await db.select({ id: scansTable.id }).from(scansTable).where(and(
    eq(scansTable.projectId, projectId),
    eq(scansTable.status, "PENDING"),
    eq(scansTable.scanMode, "CONTINUOUS"),
  )).limit(1);
  if (active || pending) return { queued: false, reason: "scan already running or queued" };

  await db.insert(scansTable).values({
    projectId,
    status: "PENDING",
    scanMode: "CONTINUOUS",
  });
  return { queued: true };
}

export async function getAutopilotConfig(projectId: string) {
  const [cfg] = await db.select().from(scanAutopilotTable).where(eq(scanAutopilotTable.projectId, projectId)).limit(1);
  return cfg || null;
}

export async function upsertAutopilotConfig(params: {
  projectId: string;
  workspacePlan: string;
  enabled: boolean;
  frequency: Frequency;
  scanMode: ScanMode;
  onDeploy: boolean;
  hourUtc: number;
  dayOfWeek: number;
}) {
  if (!isAtLeastPlan(params.workspacePlan as any, "PRO")) {
    throw new Error("Continuous autopilot requires PRO plan");
  }

  if (params.scanMode === "ACTIVE" && !isAtLeastPlan(params.workspacePlan as any, "PRO")) {
    throw new Error("ACTIVE continuous scans require PRO plan");
  }

  const nextRunAt = computeNextRunAt(
    params.frequency,
    params.hourUtc,
    params.dayOfWeek,
    new Date(),
  );

  const [existing] = await db.select().from(scanAutopilotTable)
    .where(eq(scanAutopilotTable.projectId, params.projectId))
    .limit(1);

  if (existing) {
    const [updated] = await db.update(scanAutopilotTable).set({
      enabled: params.enabled,
      frequency: params.frequency,
      scanMode: params.scanMode,
      onDeploy: params.onDeploy,
      hourUtc: clampHour(params.hourUtc),
      dayOfWeek: clampDay(params.dayOfWeek),
      nextRunAt,
      updatedAt: new Date(),
    }).where(eq(scanAutopilotTable.id, existing.id)).returning();
    return updated;
  }

  const [created] = await db.insert(scanAutopilotTable).values({
    projectId: params.projectId,
    enabled: params.enabled,
    frequency: params.frequency,
    scanMode: params.scanMode,
    onDeploy: params.onDeploy,
    hourUtc: clampHour(params.hourUtc),
    dayOfWeek: clampDay(params.dayOfWeek),
    nextRunAt,
  }).returning();
  return created;
}

export function startContinuousAutopilot() {
  if (bootstrapped) return;
  bootstrapped = true;

  schedulerTimer = setInterval(() => {
    scheduleDueRuns().catch(() => {});
  }, SCHEDULER_INTERVAL_MS);

  workerTimer = setInterval(() => {
    processQueue().catch(() => {});
  }, WORKER_INTERVAL_MS);

  // Kick off immediately on boot.
  scheduleDueRuns().catch(() => {});
  processQueue().catch(() => {});
}

export function stopContinuousAutopilot() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  if (workerTimer) clearInterval(workerTimer);
  schedulerTimer = null;
  workerTimer = null;
  bootstrapped = false;
}

export async function reopenResurfacedFindings(scanId: string, projectId: string): Promise<number> {
  const currentFindings = await db.select().from(findingsTable)
    .where(eq(findingsTable.scanId, scanId));
  if (!currentFindings.length) return 0;

  const resurfaced: typeof currentFindings = [];
  for (const finding of currentFindings) {
    const [historicalFixed] = await db.select().from(findingsTable).where(and(
      eq(findingsTable.projectId, projectId),
      ne(findingsTable.scanId, scanId),
      eq(findingsTable.title, finding.title),
      eq(findingsTable.endpoint, finding.endpoint),
      eq(findingsTable.status, "FIXED"),
    )).orderBy(desc(findingsTable.updatedAt)).limit(1);
    if (historicalFixed) resurfaced.push(finding);
  }

  if (!resurfaced.length) return 0;

  await notifyWorkspace(
    projectId,
    "♻️ Regressions detected",
    `${resurfaced.length} previously fixed finding(s) resurfaced in the latest continuous scan.`,
    `/scans/${scanId}`,
    "warning",
  );

  // Append a dedicated scan log for visibility in the live logs panel/history.
  await db.insert(scanLogsTable).values({
    scanId,
    level: "WARN",
    message: `Regression detected: ${resurfaced.length} previously fixed finding(s) resurfaced.`,
  }).catch(() => {});
  return resurfaced.length;
}
