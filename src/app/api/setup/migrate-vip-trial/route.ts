import { NextResponse } from "next/server";
import { sanitizeEnv } from "@/lib/env";
import { isDbConfigured } from "@/lib/db/client";
import {
  getVipTrialMigrationSql,
  probeVipTrialColumns,
  VIP_TRIAL_MIGRATION_FILE,
} from "@/lib/db/vip-trial-migration";

async function runMigrationWithPostgres(databaseUrl: string): Promise<void> {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

  try {
    const migrationSql = getVipTrialMigrationSql();
    const statements = migrationSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      await sql.unsafe(`${statement};`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, vipTrialColumnsReady: false, error: "Database not configured." });
  }

  const probe = await probeVipTrialColumns();
  return NextResponse.json({
    success: probe.ready,
    vipTrialColumnsReady: probe.ready,
    migrationFile: VIP_TRIAL_MIGRATION_FILE,
    probeError: probe.error,
    sql: probe.ready ? null : getVipTrialMigrationSql(),
  });
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const setupToken = request.headers.get("x-setup-token");
  if (setupToken !== sanitizeEnv(process.env.JWT_SECRET)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const before = await probeVipTrialColumns();
  if (before.ready) {
    return NextResponse.json({ success: true, alreadyApplied: true, vipTrialColumnsReady: true });
  }

  const databaseUrl =
    sanitizeEnv(process.env.SUPABASE_DATABASE_URL) || sanitizeEnv(process.env.DATABASE_URL);

  if (!databaseUrl) {
    return NextResponse.json(
      { success: false, error: "SUPABASE_DATABASE_URL not set", sql: getVipTrialMigrationSql() },
      { status: 503 }
    );
  }

  try {
    await runMigrationWithPostgres(databaseUrl);
    const after = await probeVipTrialColumns();
    if (!after.ready) {
      return NextResponse.json(
        { success: false, error: "Migration ran but columns still missing.", probeError: after.error },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, vipTrialColumnsReady: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Migration failed", sql: getVipTrialMigrationSql() },
      { status: 500 }
    );
  }
}
