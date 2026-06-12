import { NextResponse } from "next/server";
import { sanitizeEnv } from "@/lib/env";
import { isDbConfigured } from "@/lib/db/client";
import {
  DEFAULT_VIP_PLANS,
  getVipPlansSeedSql,
  probeVipPlans,
  upsertVipPlansViaRest,
  VIP_PLANS_SEED_FILE,
} from "@/lib/db/vip-plans-seed";

async function runSeedSqlWithPostgres(databaseUrl: string): Promise<void> {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

  try {
    const seedSql = getVipPlansSeedSql();
    const statements = seedSql
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
      vipPlansReady: false,
      error: "Database not configured.",
    });
  }

  const probe = await probeVipPlans();

  return NextResponse.json({
    success: probe.ready,
    vipPlansReady: probe.ready,
    activePlanCount: probe.activeCount,
    expectedPlans: DEFAULT_VIP_PLANS.map((p) => ({ id: p.id, name: p.name })),
    seedFile: VIP_PLANS_SEED_FILE,
    probeError: probe.error,
    sql: probe.ready ? null : getVipPlansSeedSql(),
    hint: probe.ready
      ? "VIP plans present. Website payment modal can load plans."
      : "Run SQL in Supabase, npm run seed:vip-plans, or POST here with x-setup-token.",
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

  const before = await probeVipPlans();
  if (before.ready) {
    return NextResponse.json({
      success: true,
      alreadySeeded: true,
      vipPlansReady: true,
      activePlanCount: before.activeCount,
    });
  }

  const databaseUrl =
    sanitizeEnv(process.env.SUPABASE_DATABASE_URL) || sanitizeEnv(process.env.DATABASE_URL);

  try {
    if (databaseUrl) {
      await runSeedSqlWithPostgres(databaseUrl);
    } else {
      await upsertVipPlansViaRest();
    }

    const after = await probeVipPlans();
    if (!after.ready) {
      return NextResponse.json(
        {
          success: false,
          error: "Seed ran but fewer than 3 active VIP plans found.",
          activePlanCount: after.activeCount,
          probeError: after.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      vipPlansReady: true,
      activePlanCount: after.activeCount,
      plans: DEFAULT_VIP_PLANS.map((p) => p.id),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "VIP plans seed failed",
        sql: getVipPlansSeedSql(),
      },
      { status: 500 }
    );
  }
}
