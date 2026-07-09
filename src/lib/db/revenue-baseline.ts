import { supabaseRest } from "@/lib/db/rest";
import { logActivity } from "@/lib/db/repository";

/** UTC instant — completed transactions at or after this time count toward displayed revenue. */
export async function getRevenueResetAt(): Promise<string | null> {
  const { data, error } = await supabaseRest<{ revenue_reset_at: string | null }[]>(
    "site_settings?select=revenue_reset_at&id=eq.main&limit=1"
  );
  if (error) {
    if (/revenue_reset_at|schema cache/i.test(error)) return null;
    throw new Error(error);
  }
  const raw = data?.[0]?.revenue_reset_at;
  return raw ? String(raw) : null;
}

export async function setRevenueResetNow(adminId: string, adminName: string): Promise<string> {
  const resetAt = new Date().toISOString();
  const { error } = await supabaseRest("site_settings?id=eq.main", {
    method: "PATCH",
    body: JSON.stringify({ revenue_reset_at: resetAt, updated_at: resetAt }),
  });
  if (error) {
    if (/revenue_reset_at|schema cache/i.test(error)) {
      throw new Error("revenue_reset_at column missing — run migration 022_revenue_baseline.sql");
    }
    throw new Error(error);
  }
  await logActivity(
    adminId,
    adminName,
    "update",
    "payments",
    `Revenue display baseline reset at ${resetAt}`,
    "revenue-baseline"
  );
  return resetAt;
}

export function transactionCountsTowardRevenue(
  createdAt: string,
  status: string,
  revenueResetAt: string | null
): boolean {
  if (status !== "completed") return false;
  if (!revenueResetAt) return true;
  return new Date(createdAt).getTime() >= new Date(revenueResetAt).getTime();
}
