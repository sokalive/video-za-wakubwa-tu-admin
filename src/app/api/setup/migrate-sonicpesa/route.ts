import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sanitizeEnv } from "@/lib/env";
import { isDbConfigured } from "@/lib/db/client";
import { buildSupabaseDatabaseUrl } from "@/lib/db/supabase-database-url";
import {
  getSonicpesaMigrationSql,
  probeSonicpesaTables,
  SONICPESA_MIGRATION_FILE,
} from "@/lib/db/sonicpesa-migration";

async function runMigrationWithPostgres(databaseUrl: string): Promise<void> {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, { ssl: "require", max: 1 });
  try {
    const migrationSql = getSonicpesaMigrationSql();
    const statements = migrationSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--") && !s.startsWith("NOTIFY"));
    for (const statement of statements) {
      await sql.unsafe(`${statement};`);
    }
    await sql.unsafe(`NOTIFY pgrst, 'reload schema';`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, sonicpesaTablesReady: false, error: "Database not configured." });
  }
  const probe = await probeSonicpesaTables();
  return NextResponse.json({
    success: probe.ready,
    sonicpesaTablesReady: probe.ready,
    migrationFile: SONICPESA_MIGRATION_FILE,
    probeError: probe.error,
    sql: probe.ready ? null : getSonicpesaMigrationSql(),
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

  const before = await probeSonicpesaTables();
  if (before.ready) {
    return NextResponse.json({ success: true, alreadyApplied: true, sonicpesaTablesReady: true });
  }

  const databaseUrl = buildSupabaseDatabaseUrl();
  if (!databaseUrl) {
    return NextResponse.json(
      {
        success: false,
        error: "Set SUPABASE_DATABASE_URL or SUPABASE_DB_PASSWORD on Vercel, or run SQL manually.",
        sql: getSonicpesaMigrationSql(),
      },
      { status: 503 }
    );
  }

  try {
    await runMigrationWithPostgres(databaseUrl);
    const after = await probeSonicpesaTables();
    if (!after.ready) {
      return NextResponse.json(
        { success: false, error: "Migration ran but tables still missing.", probeError: after.error },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, sonicpesaTablesReady: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Migration failed", sql: getSonicpesaMigrationSql() },
      { status: 500 }
    );
  }
}
