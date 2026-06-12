import { readFileSync } from "fs";
import { join } from "path";
import { supabaseRest } from "@/lib/db/rest";

export const SONICPESA_MIGRATION_FILE = "supabase/migrations/008_sonicpesa_billing.sql";

export function getSonicpesaMigrationSql(): string {
  try {
    return readFileSync(join(process.cwd(), SONICPESA_MIGRATION_FILE), "utf8");
  } catch {
    return "-- See supabase/migrations/008_sonicpesa_billing.sql";
  }
}

export async function probeSonicpesaTables(): Promise<{ ready: boolean; error: string | null }> {
  const [sp, checkout, tx, sub] = await Promise.all([
    supabaseRest<unknown[]>("sonicpesa_settings?select=id&limit=0"),
    supabaseRest<unknown[]>("checkout_payment_settings?select=id&limit=0"),
    supabaseRest<unknown[]>("transactions?select=id&limit=0"),
    supabaseRest<unknown[]>("device_subscriptions?select=device_id&limit=0"),
  ]);

  const error = sp.error || checkout.error || tx.error || sub.error;
  if (error) {
    return { ready: false, error };
  }
  return { ready: true, error: null };
}
