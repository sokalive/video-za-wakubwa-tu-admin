import { supabaseRest } from "@/lib/db/rest";
import { logActivity } from "@/lib/db/repository";

const BASELINE_ENTITY_ID = "revenue-baseline";

function parseResetAtFromDetails(details: string): string | null {
  const trimmed = String(details ?? "").trim();
  const prefixed = trimmed.match(/revenue_reset_at=([^\s]+)/i);
  if (prefixed?.[1]) return prefixed[1];
  const iso = trimmed.match(/(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/);
  return iso?.[1] ?? null;
}

async function getRevenueResetAtFromActivityLog(): Promise<string | null> {
  const { data, error } = await supabaseRest<{ created_at: string; details: string }[]>(
    `activity_logs?entity_id=eq.${BASELINE_ENTITY_ID}&entity=eq.payments&action=eq.update&order=created_at.desc&limit=1`
  );
  if (error) {
    if (/relation|schema cache|does not exist/i.test(error)) return null;
    throw new Error(error);
  }
  const row = data?.[0];
  if (!row) return null;
  return parseResetAtFromDetails(row.details) ?? String(row.created_at);
}

/** UTC instant — completed transactions at or after this time count toward displayed revenue. */
export async function getRevenueResetAt(): Promise<string | null> {
  const { data, error } = await supabaseRest<{ revenue_reset_at: string | null }[]>(
    "site_settings?select=revenue_reset_at&id=eq.main&limit=1"
  );
  if (!error) {
    const raw = data?.[0]?.revenue_reset_at;
    if (raw) return String(raw);
    return getRevenueResetAtFromActivityLog();
  }
  if (/revenue_reset_at|schema cache/i.test(error)) {
    return getRevenueResetAtFromActivityLog();
  }
  throw new Error(error);
}

export async function setRevenueResetNow(adminId: string, adminName: string): Promise<string> {
  const resetAt = new Date().toISOString();
  const { error } = await supabaseRest("site_settings?id=eq.main", {
    method: "PATCH",
    body: JSON.stringify({ revenue_reset_at: resetAt, updated_at: resetAt }),
  });

  if (error && !/revenue_reset_at|schema cache/i.test(error)) {
    throw new Error(error);
  }

  await logActivity(
    adminId,
    adminName,
    "update",
    "payments",
    `revenue_reset_at=${resetAt}`,
    BASELINE_ENTITY_ID
  );

  if (error && /revenue_reset_at|schema cache/i.test(error)) {
    return resetAt;
  }
  if (error) {
    throw new Error(error);
  }

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
