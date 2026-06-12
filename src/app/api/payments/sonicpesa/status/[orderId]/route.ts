import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { getTransactionByOrderId } from "@/lib/payments/billing-store";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  try {
    const { orderId } = await params;
    const oid = String(orderId ?? "").trim();
    if (!oid) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

    const txn = await getTransactionByOrderId(oid);
    if (!txn) return NextResponse.json({ error: "Unknown order" }, { status: 404 });

    const raw = txn.raw_payload && typeof txn.raw_payload === "object" ? txn.raw_payload : {};
    if (raw.payment_provider !== "sonicpesa") {
      return NextResponse.json({ error: "Not a SonicPesa order" }, { status: 404 });
    }

    const st = txn.status === "completed" ? "SUCCESS" : txn.status === "failed" ? "FAILED" : "PENDING";
    return NextResponse.json(
      {
        ok: true,
        order_id: txn.order_id,
        provider_order_id: raw.provider_order_id ?? txn.external_id ?? null,
        status: st,
        transaction_status: txn.status,
      },
      { headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
