import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isDbConfigured } from "@/lib/db/client";
import { computePaymentStats } from "@/lib/db/admin-data";
import { setRevenueResetNow } from "@/lib/db/revenue-baseline";

export async function POST() {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const revenueResetAt = await setRevenueResetNow(session.adminId, session.name);
    const stats = await computePaymentStats();
    return NextResponse.json({ success: true, revenueResetAt, stats });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Reset failed" },
      { status: 500 }
    );
  }
}
