import { durationToMs, type PlanDurationUnit } from "@/lib/duration";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Stack subscription expiry preserving time-of-day (e.g. purchase 22:00 → expires 22:00 on expiry day). */
export function computeStackedExpiryFromDuration(
  previousExpiresAt: string | Date | null | undefined,
  durationValue: number,
  durationUnit: PlanDurationUnit,
  nowMs = Date.now()
): {
  expiresAt: string;
  previousExpiresAt: string | null;
  anchorAt: string;
  durationMs: number;
  stacked: boolean;
} {
  const durationMs = durationToMs(durationValue, durationUnit);
  const now = new Date(nowMs);
  let anchor = now;
  let previousIso: string | null = null;
  if (previousExpiresAt != null && previousExpiresAt !== "") {
    const prev = previousExpiresAt instanceof Date ? previousExpiresAt : new Date(previousExpiresAt);
    if (!Number.isNaN(prev.getTime()) && prev.getTime() > now.getTime()) {
      anchor = prev;
      previousIso = prev.toISOString();
    }
  }
  const expiresAt = new Date(anchor.getTime() + durationMs).toISOString();
  return {
    expiresAt,
    previousExpiresAt: previousIso,
    anchorAt: anchor.toISOString(),
    durationMs,
    stacked: Boolean(previousIso),
  };
}

export function computeStackedExpiryIso(
  previousExpiresAt: string | Date | null | undefined,
  durationDays: number,
  nowMs = Date.now()
): {
  expiresAt: string;
  previousExpiresAt: string | null;
  anchorAt: string;
  purchasedDurationDays: number;
  stacked: boolean;
} {
  const days = Math.max(1, Math.trunc(Number(durationDays) || 1));
  const now = new Date(nowMs);
  let anchor = now;
  let previousIso: string | null = null;
  if (previousExpiresAt != null && previousExpiresAt !== "") {
    const prev = previousExpiresAt instanceof Date ? previousExpiresAt : new Date(previousExpiresAt);
    if (!Number.isNaN(prev.getTime()) && prev.getTime() > now.getTime()) {
      anchor = prev;
      previousIso = prev.toISOString();
    }
  }
  const expiresAt = new Date(anchor.getTime() + days * MS_PER_DAY).toISOString();
  return {
    expiresAt,
    previousExpiresAt: previousIso,
    anchorAt: anchor.toISOString(),
    purchasedDurationDays: days,
    stacked: Boolean(previousIso),
  };
}
