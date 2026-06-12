import { readFileSync } from "fs";
import { join } from "path";
import { supabaseRest } from "@/lib/db/rest";

export const VIP_TRIAL_MIGRATION_FILE = "supabase/migrations/007_vip_plans_and_trial.sql";

export function getVipTrialMigrationSql(): string {
  try {
    return readFileSync(join(process.cwd(), VIP_TRIAL_MIGRATION_FILE), "utf8");
  } catch {
    return `-- See supabase/migrations/007_vip_plans_and_trial.sql`;
  }
}

export async function probeVipTrialColumns(): Promise<{
  ready: boolean;
  error: string | null;
}> {
  const [plansProbe, settingsProbe, videosProbe] = await Promise.all([
    supabaseRest<unknown[]>("vip_plans?select=id,duration_value,duration_unit&limit=0"),
    supabaseRest<unknown[]>(
      "site_settings?select=id,vip_trial_enabled,vip_trial_duration_value,vip_trial_duration_unit&limit=0"
    ),
    supabaseRest<unknown[]>("videos?select=id,trial_enabled,trial_duration_value,trial_duration_unit&limit=0"),
  ]);

  const error = plansProbe.error || settingsProbe.error || videosProbe.error;
  if (error) {
    return {
      ready: false,
      error: /duration_value|vip_trial|trial_enabled|schema cache/i.test(error)
        ? error
        : error,
    };
  }

  return { ready: true, error: null };
}
