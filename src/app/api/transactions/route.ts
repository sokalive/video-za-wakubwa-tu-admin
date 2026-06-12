import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isDbConfigured } from "@/lib/db/client";
import { listTransactionsAdmin } from "@/lib/payments/billing-store";

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const rows = await listTransactionsAdmin({ status });
    const data = rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      externalId: row.external_id,
      planId: row.plan_id,
      planName: row.vip_plans?.name ?? "",
      phone: row.phone,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      deviceId: row.device_id,
      paymentProvider:
        row.raw_payload && typeof row.raw_payload === "object"
          ? (row.raw_payload as Record<string, unknown>).payment_provider ?? null
          : null,
      createdAt: row.created_at,
    }));
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
