import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig, isValidSupabaseUrl } from "@/lib/env";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const { url, serviceRoleKey } = getSupabaseConfig();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  if (!isValidSupabaseUrl(url)) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL. Use your Project URL from Supabase → Settings → API (https://xxxxx.supabase.co)."
    );
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return adminClient;
}

export function isDbConfigured(): boolean {
  const { url, serviceRoleKey } = getSupabaseConfig();
  return !!(url && serviceRoleKey && isValidSupabaseUrl(url));
}

export const STORAGE_BUCKET = "media";
