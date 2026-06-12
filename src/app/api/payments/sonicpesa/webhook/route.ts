import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { billingStore } from "@/lib/payments/billing-store";
import { handleSonicpesaWebhook } from "@/lib/payments/providers/sonicpesa";

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const result = await handleSonicpesaWebhook(request.headers, body, billingStore);
    if (result.status === 401) {
      return new NextResponse(result.message ?? "invalid signature", { status: 401 });
    }
    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error("[sonicpesa webhook]", err);
    return new NextResponse(null, { status: 200 });
  }
}
