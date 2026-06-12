import { readFileSync } from "fs";
import { join } from "path";
import { supabaseRest } from "@/lib/db/rest";

export const VIP_PLANS_SEED_FILE = "supabase/migrations/005_vip_plans_seed.sql";

export const DEFAULT_VIP_PLANS = [
  {
    id: "plan-daily",
    name: "1 Day",
    type: "daily" as const,
    price: 2000,
    duration_days: 1,
    duration_label: "1 Day",
    currency: "TZS",
    features: ["Access all VIP videos", "HD quality", "No ads"],
    is_active: true,
    popular: false,
  },
  {
    id: "plan-weekly",
    name: "1 Week",
    type: "weekly" as const,
    price: 8000,
    duration_days: 7,
    duration_label: "1 Week",
    currency: "TZS",
    features: ["Access all VIP videos", "Full HD quality", "No ads", "Priority support"],
    is_active: true,
    popular: true,
  },
  {
    id: "plan-monthly",
    name: "1 Month",
    type: "monthly" as const,
    price: 20000,
    duration_days: 30,
    duration_label: "1 Month",
    currency: "TZS",
    features: ["Access all VIP videos", "Best quality", "No ads", "Unlimited downloads", "VIP badge"],
    is_active: true,
    popular: false,
  },
];

export function getVipPlansSeedSql(): string {
  try {
    return readFileSync(join(process.cwd(), VIP_PLANS_SEED_FILE), "utf8");
  } catch {
    return `-- Fallback bundled in vip-plans-seed.ts — use POST /api/setup/seed-vip-plans`;
  }
}

export async function probeVipPlans(): Promise<{
  ready: boolean;
  activeCount: number;
  error: string | null;
}> {
  const { data, error, status } = await supabaseRest<{ id: string; is_active: boolean }[]>(
    "vip_plans?select=id,is_active"
  );

  if (error) {
    return {
      ready: false,
      activeCount: 0,
      error: /vip_plans|schema cache/i.test(error) ? error : `HTTP ${status}: ${error}`,
    };
  }

  const activeCount = (data ?? []).filter((plan) => plan.is_active).length;
  return {
    ready: activeCount >= 3,
    activeCount,
    error: null,
  };
}

export async function upsertVipPlansViaRest(): Promise<void> {
  for (const plan of DEFAULT_VIP_PLANS) {
    const { error, status } = await supabaseRest("vip_plans", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(plan),
    });
    if (error) {
      throw new Error(`Failed to upsert ${plan.id} (HTTP ${status}): ${error}`);
    }
  }
}
