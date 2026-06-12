import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sanitizeEnv } from "@/lib/env";
import { isDbConfigured } from "@/lib/db/client";
import { maskSecret } from "@/lib/payments/billing-normalize";
import {
  getCheckoutPaymentSettings,
  getSonicpesaRow,
  updateCheckoutPaymentProvider,
  updateSonicpesaRowFull,
} from "@/lib/payments/billing-store";
import { resolveSonicpesaCredentials, testConnection } from "@/lib/payments/providers/sonicpesa";

function defaultWebhookUrl(request: NextRequest): string {
  const base = (
    sanitizeEnv(process.env.NEXT_PUBLIC_APP_URL) ||
    sanitizeEnv(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}`
  ).replace(/\/$/, "");
  return `${base}/api/payments/sonicpesa/webhook`;
}

function normalizeEnvironment(v: unknown): string {
  const s = String(v || "").trim().toLowerCase();
  if (s === "production" || s === "live") return "live";
  if (s === "test" || s === "sandbox") return "sandbox";
  return "sandbox";
}

async function rowToApiResponse(row: Awaited<ReturnType<typeof getSonicpesaRow>>, request: NextRequest) {
  const r = row && typeof row === "object" ? row : null;
  const cred = resolveSonicpesaCredentials(r);
  const checkout = await getCheckoutPaymentSettings();
  const isActiveCheckoutProvider = checkout.payment_provider === "sonicpesa";
  const apiEndpoint = String(r?.api_endpoint ?? "").trim() || "https://api.sonicpesa.com/api/v1";
  const accountId = String(r?.account_id ?? "").trim();
  const webhookUrl = String(r?.webhook_url ?? "").trim() || defaultWebhookUrl(request);
  const hasKey = Boolean(String(process.env.SONICPESA_API_KEY || r?.api_key || "").trim());
  const apiKeyMasked = hasKey
    ? maskSecret(String(process.env.SONICPESA_API_KEY || r?.api_key || "").trim())
    : "";
  const envOverrideActive = {
    apiEndpoint: Boolean(String(process.env.SONICPESA_ENDPOINT || "").trim()),
    accountId: Boolean(String(process.env.SONICPESA_ACCOUNT_ID || "").trim()),
    apiKey: Boolean(String(process.env.SONICPESA_API_KEY || "").trim()),
    webhookUrl: Boolean(String(process.env.SONICPESA_WEBHOOK_URL || "").trim()),
  };
  return {
    enabled: r?.enabled === true,
    isActiveCheckoutProvider,
    payment_provider: checkout.payment_provider,
    environment: normalizeEnvironment(r?.environment),
    apiEndpoint,
    api_endpoint: apiEndpoint,
    effectiveApiEndpoint: cred.apiEndpoint,
    effectiveAccountId: cred.accountId,
    envOverrideActive,
    envOverrideAny: Object.values(envOverrideActive).some(Boolean),
    hasApiKey: hasKey,
    apiKeyMasked: apiKeyMasked || "******",
    accountId,
    account_id: accountId,
    webhookUrl,
    webhook_url: webhookUrl,
    lastTestAt: r?.last_test_at ?? null,
    last_test_at: r?.last_test_at ?? null,
    lastTestOk: r?.last_test_ok ?? null,
    last_test_ok: r?.last_test_ok ?? null,
    lastTestMessage: r?.last_test_message ?? "",
    last_test_message: r?.last_test_message ?? "",
    lastWebhookAt: r?.last_webhook_at ?? null,
    last_webhook_at: r?.last_webhook_at ?? null,
    lastWebhookEvent: String(r?.last_webhook_event ?? ""),
    last_webhook_event: String(r?.last_webhook_event ?? ""),
    lastWebhookOrderId: String(r?.last_webhook_order_id ?? ""),
    last_webhook_order_id: String(r?.last_webhook_order_id ?? ""),
  };
}

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const row = await getSonicpesaRow();
    return NextResponse.json({ success: true, data: await rowToApiResponse(row, request) });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const b = await request.json();
    const current = (await getSonicpesaRow()) || null;
    const nextKey = String(b.apiKey ?? b.api_key ?? "").trim();
    const keepKey =
      nextKey === "" ||
      nextKey === "••••••••" ||
      (nextKey.length > 0 && /^[•\u2022\s]+$/.test(nextKey));

    const apiEndpointIn = String(b.apiEndpoint ?? b.api_endpoint ?? current?.api_endpoint ?? "").trim();
    if (!apiEndpointIn && !keepKey && Boolean(b.enabled)) {
      return NextResponse.json({ success: false, error: "API endpoint is required when SonicPesa is enabled" }, { status: 400 });
    }

    const row = await updateSonicpesaRowFull({
      enabled: Boolean(b.enabled ?? current?.enabled ?? false),
      environment: normalizeEnvironment(b.environment ?? current?.environment ?? "sandbox"),
      api_endpoint: apiEndpointIn || "https://api.sonicpesa.com/api/v1",
      account_id: String(b.accountId ?? b.account_id ?? current?.account_id ?? ""),
      webhook_url: String(b.webhookUrl ?? b.webhook_url ?? current?.webhook_url ?? defaultWebhookUrl(request)),
      keep_api_key: keepKey,
      api_key: keepKey ? "" : nextKey,
      last_test_at: b.lastTestAt ?? b.last_test_at ?? current?.last_test_at ?? null,
      last_test_ok: b.lastTestOk ?? b.last_test_ok ?? current?.last_test_ok ?? null,
      last_test_message: b.lastTestMessage ?? b.last_test_message ?? current?.last_test_message ?? null,
    });

    const wantProvider = String(b.payment_provider ?? "").trim().toLowerCase();
    if (wantProvider === "sonicpesa" || b.setAsActiveCheckoutProvider === true) {
      await updateCheckoutPaymentProvider("sonicpesa");
    } else if (wantProvider === "legacy") {
      await updateCheckoutPaymentProvider("legacy");
    }

    return NextResponse.json({ success: true, data: await rowToApiResponse(row, request) });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
