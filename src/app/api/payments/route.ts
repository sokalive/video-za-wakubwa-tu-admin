import { NextRequest, NextResponse } from "next/server";
import { computePaymentStats, listBillingTransactions } from "@/lib/db/admin-data";
import { isDbConfigured } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  try {
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";

    const [data, stats] = await Promise.all([
      listBillingTransactions(status),
      computePaymentStats(),
    ]);

    return NextResponse.json({
      success: true,
      data,
      stats: refresh ? { ...stats, recalculatedAt: new Date().toISOString() } : stats,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
