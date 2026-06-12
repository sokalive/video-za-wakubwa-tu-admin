import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isDbConfigured } from "@/lib/db/client";
import {
  DEFAULT_VIP_PLANS,
  probeVipPlans,
  upsertVipPlansViaRest,
} from "@/lib/db/vip-plans-seed";

export async function POST() {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const before = await probeVipPlans();
    if (!before.ready) {
      await upsertVipPlansViaRest();
    }

    const after = await probeVipPlans();
    return NextResponse.json({
      success: after.ready,
      vipPlansReady: after.ready,
      activePlanCount: after.activeCount,
      alreadySeeded: before.ready,
      plans: DEFAULT_VIP_PLANS.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 }
    );
  }
}
