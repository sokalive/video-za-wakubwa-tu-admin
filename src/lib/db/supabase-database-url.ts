import { sanitizeEnv } from "@/lib/env";

function poolerDatabaseUrl(ref: string, password: string): string {
  const region = sanitizeEnv(process.env.SUPABASE_DB_REGION) || "ap-southeast-1";
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
}

export function buildSupabaseDatabaseUrl(): string | null {
  const explicit =
    sanitizeEnv(process.env.SUPABASE_DATABASE_URL) || sanitizeEnv(process.env.DATABASE_URL);
  if (explicit) return explicit;

  const password = sanitizeEnv(process.env.SUPABASE_DB_PASSWORD);
  const supabaseUrl = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!password || !supabaseUrl) return null;

  try {
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    return poolerDatabaseUrl(ref, password);
  } catch {
    return null;
  }
}
