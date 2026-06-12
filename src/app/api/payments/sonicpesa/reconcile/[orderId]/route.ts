import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { reconcileSonicpesaOrder } from "@/lib/payments/reconcile";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  try {
    const { orderId } = await params;
    const result = await reconcileSonicpesaOrder(String(orderId ?? "").trim());
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
