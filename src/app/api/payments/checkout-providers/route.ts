import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { supabaseRest } from "@/lib/db/rest";
import { getCheckoutPaymentSettings, getSonicpesaRow } from "@/lib/payments/billing-store";
import { resolveSonicpesaCredentials } from "@/lib/payments/providers/sonicpesa";
import { maskSecret } from "@/lib/payments/billing-normalize";

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }
  try {
    const checkout = await getCheckoutPaymentSettings();
    const sonicRow = await getSonicpesaRow();
    const cred = resolveSonicpesaCredentials(sonicRow);
    const sonicConfigured = Boolean(cred.apiKey);
    const providers = [
      {
        id: "legacy",
        label: "Legacy VIP Pay",
        enabled: true,
        configured: true,
        active: checkout.payment_provider === "legacy",
      },
      {
        id: "sonicpesa",
        label: "SonicPesa",
        enabled: sonicRow?.enabled === true,
        configured: sonicConfigured,
        active: checkout.payment_provider === "sonicpesa",
        apiKeyMasked: sonicConfigured ? maskSecret(cred.apiKey) : "",
      },
    ];
    return NextResponse.json({
      success: true,
      activeProvider: checkout.payment_provider,
      providers,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
