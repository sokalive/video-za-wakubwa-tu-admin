import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isDbConfigured } from "@/lib/db/client";
import { getSonicpesaRow, updateSonicpesaRowFull } from "@/lib/payments/billing-store";
import { resolveSonicpesaCredentials, testConnection } from "@/lib/payments/providers/sonicpesa";

function defaultWebhookUrl(request: NextRequest): string {
  const host = request.nextUrl.host;
  return `https://${host}/api/payments/sonicpesa/webhook`;
}

function normalizeEnvironment(v: unknown): string {
  const s = String(v || "").trim().toLowerCase();
  if (s === "production" || s === "live") return "live";
  return "sandbox";
}

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const row = (await getSonicpesaRow()) || null;
    const cred = resolveSonicpesaCredentials(row);
    const result = await testConnection(cred);
    const now = new Date().toISOString();
    await updateSonicpesaRowFull({
      enabled: Boolean(row?.enabled),
      environment: normalizeEnvironment(row?.environment ?? "sandbox"),
      api_endpoint: String(row?.api_endpoint ?? ""),
      account_id: String(row?.account_id ?? ""),
      webhook_url: String(row?.webhook_url ?? defaultWebhookUrl(request)),
      keep_api_key: true,
      api_key: "",
      last_test_at: now,
      last_test_ok: result.ok,
      last_test_message: result.message,
    });
    return NextResponse.json({
      success: result.ok,
      message: result.message,
      httpStatus: Number(result.httpStatus || 0),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
