export const PLAN_DURATION_UNITS = [
  "seconds",
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
] as const;

export const TRIAL_DURATION_UNITS = ["seconds", "minutes", "hours"] as const;

export type PlanDurationUnit = (typeof PLAN_DURATION_UNITS)[number];
export type TrialDurationUnit = (typeof TRIAL_DURATION_UNITS)[number];

export function durationToDays(value: number, unit: PlanDurationUnit): number {
  const v = Math.max(0, value);
  switch (unit) {
    case "seconds":
      return Math.max(1, Math.ceil(v / 86_400));
    case "minutes":
      return Math.max(1, Math.ceil(v / 1_440));
    case "hours":
      return Math.max(1, Math.ceil(v / 24));
    case "days":
      return Math.max(1, v);
    case "weeks":
      return Math.max(1, v * 7);
    case "months":
      return Math.max(1, v * 30);
    default:
      return Math.max(1, v);
  }
}

export function formatDurationLabel(value: number, unit: string): string {
  const label = unit.charAt(0).toUpperCase() + unit.slice(1);
  return value === 1 ? `1 ${label.replace(/s$/, "")}` : `${value} ${label}`;
}

export function inferPlanDurationUnit(durationDays: number, legacyType?: string): PlanDurationUnit {
  if (legacyType === "weekly") return "weeks";
  if (legacyType === "monthly") return "months";
  if (legacyType === "daily") return "days";
  return "days";
}
