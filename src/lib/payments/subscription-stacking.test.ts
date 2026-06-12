import { describe, expect, it } from "vitest";
import { computeStackedExpiryFromDuration } from "./subscription-stacking";

describe("computeStackedExpiryFromDuration", () => {
  it("preserves time-of-day for 1 day plan (purchase 22:00 → expires 22:00 next day)", () => {
    const purchaseAt = new Date("2026-06-10T22:00:00.000Z");
    const result = computeStackedExpiryFromDuration(null, 1, "days", purchaseAt.getTime());
    expect(result.expiresAt).toBe("2026-06-11T22:00:00.000Z");
  });

  it("preserves time-of-day for 1 week plan", () => {
    const purchaseAt = new Date("2026-06-10T22:00:00.000Z");
    const result = computeStackedExpiryFromDuration(null, 1, "weeks", purchaseAt.getTime());
    expect(result.expiresAt).toBe("2026-06-17T22:00:00.000Z");
  });

  it("preserves time-of-day for 1 month plan (30 days)", () => {
    const purchaseAt = new Date("2026-06-10T22:00:00.000Z");
    const result = computeStackedExpiryFromDuration(null, 1, "months", purchaseAt.getTime());
    expect(result.expiresAt).toBe("2026-07-10T22:00:00.000Z");
  });

  it("stacks from existing expiry when still active", () => {
    const purchaseAt = new Date("2026-06-10T22:00:00.000Z");
    const existing = "2026-06-15T22:00:00.000Z";
    const result = computeStackedExpiryFromDuration(existing, 1, "days", purchaseAt.getTime());
    expect(result.expiresAt).toBe("2026-06-16T22:00:00.000Z");
    expect(result.stacked).toBe(true);
  });
});
