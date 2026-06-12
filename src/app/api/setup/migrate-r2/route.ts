import { NextResponse } from "next/server";
import { sanitizeEnv } from "@/lib/env";
import { isDbConfigured } from "@/lib/db/client";
import { getR2MigrationSql, probeR2VideoColumns, R2_MIGRATION_FILE } from "@/lib/db/r2-migration";

async function runMigrationWithPostgres(databaseUrl: string): Promise<void> {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

  try {
    const migrationSql = getR2MigrationSql();
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
      r2ColumnsReady: false,
      error: "Database not configured.",
    });
  }

  const probe = await probeR2VideoColumns();

  return NextResponse.json({
    success: probe.ready,
    r2ColumnsReady: probe.ready,
    migrationFile: R2_MIGRATION_FILE,
    probeError: probe.error,
    sql: probe.ready ? null : getR2MigrationSql(),
    hint: probe.ready
      ? "R2 columns present. Add Video save should work."
      : `Run the SQL in Supabase SQL Editor, or POST here with x-setup-token after setting SUPABASE_DATABASE_URL on Vercel.`,
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

  const before = await probeR2VideoColumns();
  if (before.ready) {
    return NextResponse.json({
      success: true,
      alreadyApplied: true,
      r2ColumnsReady: true,
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
        migrationFile: R2_MIGRATION_FILE,
        sql: getR2MigrationSql(),
      },
      { status: 503 }
    );
  }

  try {
    await runMigrationWithPostgres(databaseUrl);
    const after = await probeR2VideoColumns();

    if (!after.ready) {
      return NextResponse.json(
        {
          success: false,
          error: "Migration ran but R2 columns still missing in API schema cache.",
          probeError: after.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      r2ColumnsReady: true,
      message: "R2 migration applied successfully.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Migration failed",
        sql: getR2MigrationSql(),
      },
      { status: 500 }
    );
  }
}
