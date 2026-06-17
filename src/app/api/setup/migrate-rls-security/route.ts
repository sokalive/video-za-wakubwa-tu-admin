import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sanitizeEnv } from "@/lib/env";
import { isDbConfigured } from "@/lib/db/client";
import { buildSupabaseDatabaseUrl } from "@/lib/db/supabase-database-url";
import {
  getRlsSecurityMigrationSql,
  probeRlsSecurityLockdown,
  RLS_SECURITY_MIGRATION_FILE,
} from "@/lib/db/rls-security-migration";

async function runMigrationWithPostgres(databaseUrl: string): Promise<void> {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, { ssl: "require", max: 1 });
  try {
    await sql.unsafe(getRlsSecurityMigrationSql());
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, rlsLockdownReady: false, error: "Database not configured." });
  }
  const probe = await probeRlsSecurityLockdown();
  return NextResponse.json({
    success: probe.ready,
    rlsLockdownReady: probe.ready,
    migrationFile: RLS_SECURITY_MIGRATION_FILE,
    probeError: probe.error,
    checks: probe.checks,
    sql: probe.ready ? null : getRlsSecurityMigrationSql(),
  });
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const setupToken = request.headers.get("x-setup-token");
  const session = await getSession();
  const authorized =
    (setupToken && setupToken === sanitizeEnv(process.env.JWT_SECRET)) || !!session;

  if (!authorized) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const before = await probeRlsSecurityLockdown();
  if (before.ready) {
    return NextResponse.json({ success: true, alreadyApplied: true, rlsLockdownReady: true, checks: before.checks });
  }

  const databaseUrl = buildSupabaseDatabaseUrl();
  if (!databaseUrl) {
    return NextResponse.json(
      {
        success: false,
        error: "Set SUPABASE_DATABASE_URL or SUPABASE_DB_PASSWORD on Vercel, or run SQL manually.",
        sql: getRlsSecurityMigrationSql(),
      },
      { status: 503 }
    );
  }

  try {
    await runMigrationWithPostgres(databaseUrl);
    const after = await probeRlsSecurityLockdown();
    if (!after.ready) {
      return NextResponse.json(
        { success: false, error: "Migration ran but anon probe still failing.", probeError: after.error, checks: after.checks },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, rlsLockdownReady: true, checks: after.checks });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Migration failed",
        sql: getRlsSecurityMigrationSql(),
      },
      { status: 500 }
    );
  }
}
