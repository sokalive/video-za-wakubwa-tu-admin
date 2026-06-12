import { NextResponse } from "next/server";
import { sanitizeEnv } from "@/lib/env";
import { isDbConfigured } from "@/lib/db/client";
import {
  ANALYTICS_MIGRATION_FILE,
  getAnalyticsMigrationSql,
  probeAnalyticsColumns,
} from "@/lib/db/video-analytics-migration";

async function runMigrationWithPostgres(databaseUrl: string): Promise<void> {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

  try {
    const migrationSql = getAnalyticsMigrationSql();
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
    return NextResponse.json({
      success: false,
      analyticsColumnsReady: false,
      error: "Database not configured.",
    });
  }

  const probe = await probeAnalyticsColumns();

  return NextResponse.json({
    success: probe.ready,
    analyticsColumnsReady: probe.ready,
    migrationFile: ANALYTICS_MIGRATION_FILE,
    probeError: probe.error,
    sql: probe.ready ? null : getAnalyticsMigrationSql(),
    hint: probe.ready
      ? "likes_count and autoplay columns present."
      : "Run the SQL in Supabase SQL Editor, or POST here with x-setup-token after setting SUPABASE_DATABASE_URL.",
  });
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured." }, { status: 503 });
  }

  const setupToken = request.headers.get("x-setup-token");
  if (setupToken !== sanitizeEnv(process.env.JWT_SECRET)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Provide x-setup-token header matching JWT_SECRET." },
      { status: 403 }
    );
  }

  const before = await probeAnalyticsColumns();
  if (before.ready) {
    return NextResponse.json({
      success: true,
      alreadyApplied: true,
      analyticsColumnsReady: true,
    });
  }

  const databaseUrl =
    sanitizeEnv(process.env.SUPABASE_DATABASE_URL) || sanitizeEnv(process.env.DATABASE_URL);

  if (!databaseUrl) {
    return NextResponse.json(
      {
        success: false,
        error:
          "SUPABASE_DATABASE_URL (or DATABASE_URL) is not set. Add the Postgres connection URI from Supabase → Settings → Database, redeploy, and POST again. Or run the SQL manually.",
        migrationFile: ANALYTICS_MIGRATION_FILE,
        sql: getAnalyticsMigrationSql(),
      },
      { status: 503 }
    );
  }

  try {
    await runMigrationWithPostgres(databaseUrl);
    const after = await probeAnalyticsColumns();

    if (!after.ready) {
      return NextResponse.json(
        {
          success: false,
          error: "Migration ran but analytics columns still missing in API schema cache.",
          probeError: after.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analyticsColumnsReady: true,
      message: "Analytics migration applied successfully.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Migration failed",
        sql: getAnalyticsMigrationSql(),
      },
      { status: 500 }
    );
  }
}
