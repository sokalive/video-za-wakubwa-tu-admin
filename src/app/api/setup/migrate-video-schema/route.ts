import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sanitizeEnv } from "@/lib/env";
import { isDbConfigured } from "@/lib/db/client";
import {
  getVideoSchemaMigrationSql,
  getVideoDedupMigrationSql,
  probeVideoSchemaColumns,
  VIDEO_SCHEMA_MIGRATION_FILES,
  VIDEO_DEDUP_MIGRATION_FILE,
} from "@/lib/db/video-schema-migration";
import { buildSupabaseDatabaseUrl } from "@/lib/db/supabase-database-url";
import { invalidateVideoColumnCache } from "@/lib/db/video-schema";

async function runMigrationWithPostgres(databaseUrl: string): Promise<void> {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

  try {
    const migrationSql = getVideoSchemaMigrationSql();
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
    return NextResponse.json({ success: false, videoSchemaReady: false, error: "Database not configured." });
  }

  const probe = await probeVideoSchemaColumns();
  return NextResponse.json({
    success: probe.ready,
    videoSchemaReady: probe.ready,
    vipTrialSecondsReady: probe.vipTrialSecondsReady,
    pinColumnsReady: probe.pinColumnsReady,
    dedupColumnsReady: probe.dedupColumnsReady,
    migrationFiles: VIDEO_SCHEMA_MIGRATION_FILES,
    dedupMigrationFile: VIDEO_DEDUP_MIGRATION_FILE,
    probeError: probe.error,
    sql: probe.ready ? null : getVideoSchemaMigrationSql(),
    dedupMigrationSql: probe.dedupColumnsReady ? null : getVideoDedupMigrationSql(),
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

  const before = await probeVideoSchemaColumns();
  if (before.ready) {
    return NextResponse.json({
      success: true,
      alreadyApplied: true,
      videoSchemaReady: true,
      ...before,
      dedupMigrationSql: null,
    });
  }

  const databaseUrl = buildSupabaseDatabaseUrl();
  if (!databaseUrl) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Set SUPABASE_DATABASE_URL or SUPABASE_DB_PASSWORD on Vercel, redeploy, and POST again. Or run SQL manually.",
        sql: getVideoSchemaMigrationSql(),
        ...before,
      },
      { status: 503 }
    );
  }

  try {
    await runMigrationWithPostgres(databaseUrl);
    invalidateVideoColumnCache();
    const after = await probeVideoSchemaColumns();
    if (!after.ready) {
      return NextResponse.json(
        { success: false, message: "Migration ran but columns still missing.", ...after },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, videoSchemaReady: true, ...after });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Migration failed",
        sql: getVideoSchemaMigrationSql(),
      },
      { status: 500 }
    );
  }
}
