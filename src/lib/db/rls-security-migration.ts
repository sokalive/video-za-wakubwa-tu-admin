import { readFileSync } from "fs";
import { join } from "path";
import { sanitizeEnv } from "@/lib/env";

export const RLS_SECURITY_MIGRATION_FILE = "supabase/020_rls_security_lockdown.sql";

export function getRlsSecurityMigrationSql(): string {
  try {
    return readFileSync(join(process.cwd(), RLS_SECURITY_MIGRATION_FILE), "utf8");
  } catch {
    return "-- See supabase/020_rls_security_lockdown.sql";
  }
}

async function anonRestSelect(table: string): Promise<{ denied: boolean; rows: number; error: string | null }> {
  const url = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
  const anonKey = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anonKey) {
    return { denied: false, rows: 0, error: "Missing Supabase anon env" };
  }

  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    return { denied: true, rows: 0, error: null };
  }

  const body = await res.json().catch(() => null);
  if (body && typeof body === "object" && "code" in body && body.code === "42501") {
    return { denied: true, rows: 0, error: String(body.message ?? "permission denied") };
  }

  if (!res.ok) {
    return { denied: false, rows: 0, error: `HTTP ${res.status}` };
  }

  const rows = Array.isArray(body) ? body.length : 0;
  return { denied: false, rows, error: null };
}

export async function probeRlsSecurityLockdown(): Promise<{
  ready: boolean;
  error: string | null;
  checks: Record<string, { denied: boolean; rows: number; error: string | null }>;
}> {
  const checks: Record<string, { denied: boolean; rows: number; error: string | null }> = {
    sonicpesa_settings: await anonRestSelect("sonicpesa_settings"),
    transactions: await anonRestSelect("transactions"),
    video_view_sessions: await anonRestSelect("video_view_sessions"),
    videos: await anonRestSelect("videos"),
  };

  const locked =
    checks.sonicpesa_settings.denied &&
    checks.transactions.denied &&
    checks.video_view_sessions.denied;
  const catalogOpen = !checks.videos.denied && checks.videos.rows >= 0;

  const ready = locked && catalogOpen;
  const error = ready
    ? null
    : [
        !checks.sonicpesa_settings.denied ? "sonicpesa_settings still readable by anon" : null,
        !checks.transactions.denied ? "transactions still readable by anon" : null,
        !checks.video_view_sessions.denied ? "video_view_sessions still readable by anon" : null,
        checks.videos.denied ? "videos catalog blocked for anon" : null,
      ]
        .filter(Boolean)
        .join("; ");

  return { ready, error, checks };
}
