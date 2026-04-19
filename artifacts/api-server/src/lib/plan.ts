export type WorkspacePlan = "FREE" | "PRO" | "ENTERPRISE";

export const PLAN_ORDER: Record<WorkspacePlan, number> = {
  FREE: 0,
  PRO: 1,
  ENTERPRISE: 2,
};

export function isAtLeastPlan(current: WorkspacePlan, required: WorkspacePlan): boolean {
  return (PLAN_ORDER[current] ?? 0) >= (PLAN_ORDER[required] ?? 0);
}

export function requirePlan(current: WorkspacePlan, required: WorkspacePlan): void {
  if (!isAtLeastPlan(current, required)) {
    const err = new Error("PLAN_UPGRADE_REQUIRED");
    (err as any).code = "PLAN_UPGRADE_REQUIRED";
    (err as any).required = required;
    (err as any).current = current;
    throw err;
  }
}

