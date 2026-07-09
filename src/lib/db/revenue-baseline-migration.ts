import { readFileSync } from "fs";
import { join } from "path";
import { supabaseRest } from "@/lib/db/rest";

export const REVENUE_BASELINE_MIGRATION_FILE = "supabase/migrations/022_revenue_baseline.sql";

export function getRevenueBaselineMigrationSql(): string {
  try {
    return readFileSync(join(process.cwd(), REVENUE_BASELINE_MIGRATION_FILE), "utf8");
  } catch {
    return `-- See ${REVENUE_BASELINE_MIGRATION_FILE}`;
  }
}

export async function probeRevenueBaselineColumn(): Promise<{
  ready: boolean;
  error: string | null;
}> {
  const probe = await supabaseRest<{ revenue_reset_at: string | null }[]>(
    "site_settings?select=revenue_reset_at&id=eq.main&limit=1"
  );
  if (probe.error) {
    return {
      ready: false,
      error: probe.error,
    };
  }
  return { ready: true, error: null };
}
