import assert from "node:assert/strict";

function transactionCountsTowardRevenue(createdAt, status, revenueResetAt) {
  if (status !== "completed") return false;
  if (!revenueResetAt) return true;
  return new Date(createdAt).getTime() >= new Date(revenueResetAt).getTime();
}

function revenueTotal(rows, resetAt) {
  return rows
    .filter((r) => transactionCountsTowardRevenue(r.created_at, r.status, resetAt))
    .reduce((s, r) => s + r.amount, 0);
}

const historical = [
  { created_at: "2026-06-01T10:00:00.000Z", status: "completed", amount: 2000 },
  { created_at: "2026-06-02T10:00:00.000Z", status: "completed", amount: 20000 },
];
const resetAt = "2026-07-09T12:00:00.000Z";

assert.equal(revenueTotal(historical, null), 22000);
assert.equal(revenueTotal(historical, resetAt), 0);

const afterReset = [
  ...historical,
  { created_at: "2026-07-09T13:00:00.000Z", status: "completed", amount: 2000 },
];
assert.equal(revenueTotal(afterReset, resetAt), 2000);

afterReset.push({ created_at: "2026-07-09T14:00:00.000Z", status: "completed", amount: 2000 });
assert.equal(revenueTotal(afterReset, resetAt), 4000);

assert.equal(transactionCountsTowardRevenue("2026-07-09T13:00:00.000Z", "pending", resetAt), false);

console.log("verify-revenue-baseline-logic: all assertions passed");
