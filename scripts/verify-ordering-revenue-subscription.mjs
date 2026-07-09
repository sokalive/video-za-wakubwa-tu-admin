import assert from "node:assert/strict";

function transactionCountsTowardRevenue(createdAt, status, revenueResetAt) {
  if (status !== "completed") return false;
  if (!revenueResetAt) return true;
  return new Date(createdAt).getTime() >= new Date(revenueResetAt).getTime();
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function computeStackedExpiryFromDuration(previousExpiresAt, durationValue, durationUnit, nowMs = Date.now()) {
  const units = {
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 3600 * 1000,
    days: MS_PER_DAY,
    weeks: 7 * MS_PER_DAY,
    months: 30 * MS_PER_DAY,
  };
  const durationMs = Math.max(1, Math.trunc(Number(durationValue) || 1)) * units[durationUnit];
  const now = new Date(nowMs);
  let anchor = now;
  if (previousExpiresAt) {
    const prev = new Date(previousExpiresAt);
    if (!Number.isNaN(prev.getTime()) && prev.getTime() > now.getTime()) anchor = prev;
  }
  return new Date(anchor.getTime() + durationMs).toISOString();
}

const resetAt = "2026-06-10T10:00:00.000Z";
assert.equal(transactionCountsTowardRevenue("2026-06-09T12:00:00.000Z", "completed", resetAt), false);
assert.equal(transactionCountsTowardRevenue("2026-06-10T11:00:00.000Z", "completed", resetAt), true);
assert.equal(transactionCountsTowardRevenue("2026-06-10T11:00:00.000Z", "pending", resetAt), false);

const purchaseAt = new Date("2026-06-10T22:00:00.000Z").getTime();
assert.equal(computeStackedExpiryFromDuration(null, 7, "days", purchaseAt), "2026-06-17T22:00:00.000Z");
assert.equal(computeStackedExpiryFromDuration(null, 1, "days", purchaseAt), "2026-06-11T22:00:00.000Z");
assert.equal(computeStackedExpiryFromDuration(null, 30, "days", purchaseAt), "2026-07-10T22:00:00.000Z");

console.log("verify-ordering-revenue-subscription: all assertions passed");
