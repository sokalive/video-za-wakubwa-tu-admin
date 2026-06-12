import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { getSonicpesaRow, getTransactionByOrderId } from "@/lib/payments/billing-store";
import { resolveSonicpesaCredentials, verifyPayment } from "@/lib/payments/providers/sonicpesa";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  try {
    const { orderId } = await params;
    const txn = await getTransactionByOrderId(String(orderId ?? "").trim());
    if (!txn) return NextResponse.json({ error: "Unknown order" }, { status: 404 });

    const row = await getSonicpesaRow();
    const cred = resolveSonicpesaCredentials(row || {});
    const raw = txn.raw_payload && typeof txn.raw_payload === "object" ? txn.raw_payload : {};
    const verifyId = String(raw.provider_order_id ?? txn.external_id ?? orderId).trim();
    const sp = await verifyPayment(cred, verifyId);

    return NextResponse.json(
      {
        ok: true,
        order_id: txn.order_id,
        provider_order_id: verifyId,
        http_ok: sp.ok,
        normalized: sp.normalized,
        transaction_status: txn.status,
      },
      { headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
