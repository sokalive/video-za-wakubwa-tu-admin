/**
 * SonicPesa payment provider — production integration per https://docs.sonicpesa.com/pages/payments.html
 */
import crypto from "crypto";
import { webhookExplicitFailure, webhookSuccess } from "@/lib/payments/webhook-status";
import type { BillingStore } from "@/lib/payments/billing-store";

const DEFAULT_API_BASE = "https://api.sonicpesa.com/api/v1";
const LOG_PREFIX = "[sonicpesa]";

export interface SonicpesaCredentials {
  apiKey: string;
  accountId: string;
  apiEndpoint: string;
  webhookUrl: string;
  environment: string;
}

export interface SonicpesaSettingsRow {
  enabled?: boolean;
  environment?: string;
  api_endpoint?: string;
  api_key?: string;
  account_id?: string;
  webhook_url?: string;
}

export function resolveSonicpesaCredentials(row: SonicpesaSettingsRow | null): SonicpesaCredentials {
  const r = row && typeof row === "object" ? row : {};
  const apiEndpoint = String(process.env.SONICPESA_ENDPOINT || r.api_endpoint || DEFAULT_API_BASE).trim();
  return {
    apiKey: String(process.env.SONICPESA_API_KEY || r.api_key || "").trim(),
    accountId: String(process.env.SONICPESA_ACCOUNT_ID || r.account_id || "").trim(),
    apiEndpoint: apiEndpoint.replace(/\/+$/, ""),
    webhookUrl: String(process.env.SONICPESA_WEBHOOK_URL || r.webhook_url || "").trim(),
    environment: String(r.environment || "sandbox").trim(),
  };
}

function apiBase(cred: SonicpesaCredentials): string {
  const ep = String(cred?.apiEndpoint || DEFAULT_API_BASE).trim().replace(/\/+$/, "");
  return ep || DEFAULT_API_BASE;
}

function collectPath(): string {
  const p = String(process.env.SONICPESA_COLLECT_PATH || "/payment/create_order").trim();
  return p.startsWith("/") ? p : `/${p}`;
}

function orderStatusPath(): string {
  const p = String(process.env.SONICPESA_ORDER_STATUS_PATH || "/payment/order_status").trim();
  return p.startsWith("/") ? p : `/${p}`;
}

function authHeaders(cred: SonicpesaCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-KEY": String(process.env.SONICPESA_API_KEY || cred.apiKey || "").trim(),
  };
  const secretKey = String(process.env.SONICPESA_SECRET_KEY || "").trim();
  if (secretKey) headers["X-SECRET-KEY"] = secretKey;
  const accountId = String(process.env.SONICPESA_ACCOUNT_ID || cred.accountId || "").trim();
  if (accountId) {
    headers["X-Account-Id"] = accountId;
    headers["X-Merchant-Id"] = accountId;
  }
  return headers;
}

function sonicBuyerPhone(phone: string): string {
  let p = String(phone ?? "").trim().replace(/\D/g, "");
  if (!p) return "";
  if (p.startsWith("0")) p = `255${p.slice(1)}`;
  if (p.startsWith("255")) return p;
  if (p.length === 9) return `255${p}`;
  return p;
}

export function isCreateOrderAccepted(httpRes: { ok: boolean; body: unknown }): boolean {
  if (!httpRes?.ok) return false;
  const body = httpRes.body && typeof httpRes.body === "object" ? (httpRes.body as Record<string, unknown>) : {};
  const topStatus = String(body.status ?? "").trim().toLowerCase();
  if (topStatus === "error" || topStatus === "failed") return false;
  if (topStatus === "success") return true;
  const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : null;
  if (data?.order_id != null && String(data.order_id).trim() !== "") return true;
  if (body.order_id != null && String(body.order_id).trim() !== "") return true;
  if (body.success === true) return true;
  return false;
}

export function buildCreateOrderPayload(
  cred: SonicpesaCredentials,
  { phone, amount, orderId, currency = "TZS" }: { phone: string; amount: number; orderId: string; currency?: string }
) {
  const buyerPhone = sonicBuyerPhone(phone);
  const amountInt = Math.round(Number(amount));
  const accountId = String(process.env.SONICPESA_ACCOUNT_ID || cred?.accountId || "").trim();
  const payload: Record<string, unknown> = {
    buyer_email: String(process.env.SONICPESA_BUYER_EMAIL || "customer@videozawakubwa.com").trim(),
    buyer_name: String(process.env.SONICPESA_BUYER_NAME || "VZW Customer").trim(),
    buyer_phone: buyerPhone,
    amount: amountInt,
    currency: String(currency || "TZS").trim() || "TZS",
  };
  if (accountId) payload.account_id = accountId;
  const merchantRef = String(orderId ?? "").trim();
  if (merchantRef && process.env.SONICPESA_INCLUDE_MERCHANT_REF === "1") {
    payload.merchant_order_id = merchantRef;
    payload.reference = merchantRef;
  }
  return { payload, buyerPhone, amountInt, merchantRef };
}

async function httpJson(
  url: string,
  { method = "GET", headers = {}, body }: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: ac.signal,
    });
    clearTimeout(t);
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 4000) };
    }
    return { ok: res.ok, status: res.status, body: json };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, status: 0, body: { error: e instanceof Error ? e.message : String(e) } };
  }
}

export function normalizeResponse(raw: unknown, httpStatus = 0) {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const data =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : body;
  const providerOrderId = String(data.order_id ?? data.orderId ?? body.order_id ?? body.orderId ?? "").trim();
  const paymentStatus = String(data.payment_status ?? data.status ?? body.payment_status ?? "").trim();
  const transId = String(data.transid ?? data.transaction_id ?? data.trans_id ?? body.transid ?? "").trim();
  const message = String(body.message ?? data.message ?? "").trim();
  const succeeded =
    ["SUCCESS", "COMPLETED", "PAID"].includes(paymentStatus.toUpperCase()) || webhookSuccess(body);
  const failed =
    ["FAILED", "DECLINED", "CANCELLED", "REJECTED", "USERCANCELLED"].includes(paymentStatus.toUpperCase()) ||
    webhookExplicitFailure(body) ||
    webhookExplicitFailure(data);
  return {
    httpStatus: Number(httpStatus) || 0,
    providerOrderId: providerOrderId || null,
    paymentStatus: paymentStatus || null,
    transId: transId || null,
    message: message || null,
    succeeded,
    failed,
    raw: body,
  };
}

export async function createOrder(
  cred: SonicpesaCredentials,
  { phone, amount, orderId, currency = "TZS" }: { phone: string; amount: number; orderId: string; currency?: string }
) {
  const url = `${apiBase(cred)}${collectPath()}`;
  const built = buildCreateOrderPayload(cred, { phone, amount, orderId, currency });
  const { payload, buyerPhone, amountInt, merchantRef } = built;
  if (!buyerPhone || !buyerPhone.startsWith("255") || buyerPhone.length < 12) {
    return {
      ok: false,
      httpOk: false,
      status: 0,
      body: { error: "buyer_phone must be valid Tanzania 255XXXXXXXXX" },
      normalized: null,
      requestPayload: payload,
    };
  }
  if (!Number.isFinite(amountInt) || amountInt <= 0) {
    return {
      ok: false,
      httpOk: false,
      status: 0,
      body: { error: "amount must be a positive integer" },
      normalized: null,
      requestPayload: payload,
    };
  }
  const res = await httpJson(url, { method: "POST", headers: authHeaders(cred), body: payload });
  const accepted = isCreateOrderAccepted(res);
  const normalized = normalizeResponse(res.body, res.status);
  console.log(LOG_PREFIX, "createOrder", { merchantRef, httpStatus: res.status, accepted });
  return { ...res, ok: accepted, httpOk: res.ok, normalized, merchantOrderId: merchantRef, requestPayload: payload };
}

export async function verifyPayment(cred: SonicpesaCredentials, orderId: string) {
  const oid = String(orderId ?? "").trim();
  if (!oid) {
    return { ok: false, status: 0, body: { error: "order_id is required" }, normalized: null };
  }
  const envFull = String(process.env.SONICPESA_ORDER_STATUS_URL || "").trim();
  const url = envFull ? envFull.replace(/\/+$/, "") : `${apiBase(cred)}${orderStatusPath()}`;
  const res = await httpJson(url, { method: "POST", headers: authHeaders(cred), body: { order_id: oid } });
  const normalized = normalizeResponse(res.body, res.status);
  return { ...res, normalized };
}

export function sonicPaymentSucceeded(body: unknown): boolean {
  return normalizeResponse(body).succeeded;
}

export function sonicExplicitFailure(body: unknown): boolean {
  return normalizeResponse(body).failed;
}

export function verifyWebhookSignature(headers: Headers, body: unknown): boolean {
  const secret = String(process.env.SONICPESA_WEBHOOK_SECRET || "").trim();
  if (!secret) return true;
  const rawSig = String(headers.get("x-sonicpesa-signature") ?? headers.get("x-webhook-signature") ?? "").trim();
  if (!rawSig) return false;
  const sig = rawSig.replace(/^sha256=/i, "").trim();
  const raw = JSON.stringify(body ?? {});
  const expectedHex = crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length === b.length && a.length > 0) return crypto.timingSafeEqual(a, b);
  } catch {
    // fall through
  }
  const a2 = Buffer.from(expectedHex, "utf8");
  const b2 = Buffer.from(sig, "utf8");
  return a2.length === b2.length && crypto.timingSafeEqual(a2, b2);
}

function webhookOrderIdCandidates(body: unknown): string[] {
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const nested = [o.data, o.payment, o.payload, o.transaction].filter((x) => x && typeof x === "object") as Record<
    string,
    unknown
  >[];
  const objs = [o, ...nested];
  const keys = ["order_id", "orderId", "merchant_order_id", "merchant_reference", "reference", "tx_ref"];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const obj of objs) {
    for (const k of keys) {
      const v = String(obj[k] ?? "").trim();
      if (v && !seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
  }
  return out;
}

export async function handleSonicpesaWebhook(
  headers: Headers,
  body: unknown,
  billing: BillingStore
): Promise<{ status: number; message?: string }> {
  try {
    if (!verifyWebhookSignature(headers, body)) {
      console.warn(LOG_PREFIX, "webhook invalid signature");
      return { status: 401, message: "invalid signature" };
    }
    await billing.recordSonicpesaWebhookReceived(body);
    const candidateIds = webhookOrderIdCandidates(body);
    let txn = null;
    let merchantOrderId: string | null = null;
    for (const id of candidateIds) {
      txn = await billing.getTransactionByOrderId(id);
      if (txn) {
        merchantOrderId = String(txn.order_id);
        break;
      }
    }
    if (!txn) {
      for (const id of candidateIds) {
        txn = await billing.getTransactionByExternalId(id);
        if (txn) {
          merchantOrderId = String(txn.order_id);
          break;
        }
      }
    }
    if (!txn || !merchantOrderId) {
      console.warn(LOG_PREFIX, "webhook unknown order", { candidateIds });
      return { status: 200 };
    }
    const prevPayload =
      txn.raw_payload && typeof txn.raw_payload === "object" ? (txn.raw_payload as Record<string, unknown>) : {};
    if (prevPayload.payment_provider !== "sonicpesa") {
      return { status: 200 };
    }
    if (txn.status === "completed") {
      await billing.tryActivateDeviceSubscriptionFromCompletedTxn({
        ...txn,
        status: "completed",
        order_id: merchantOrderId,
      });
      return { status: 200 };
    }
    const ok = sonicPaymentSucceeded(body);
    const fail = sonicExplicitFailure(body);
    const nextStatus = ok ? "completed" : fail ? "failed" : txn.status;
    const data =
      (body as Record<string, unknown>)?.data && typeof (body as Record<string, unknown>).data === "object"
        ? ((body as Record<string, unknown>).data as Record<string, unknown>)
        : (body as Record<string, unknown>);
    const transId = data.transid ?? data.transaction_id ?? (body as Record<string, unknown>).transid;
    const providerOrderId = String(data.order_id ?? (body as Record<string, unknown>).order_id ?? txn.external_id ?? "").trim();
    await billing.updateTransactionByOrderId(merchantOrderId, {
      status: nextStatus,
      external_id: transId != null ? String(transId) : providerOrderId || txn.external_id,
      raw_payload: {
        ...prevPayload,
        provider_order_id: providerOrderId || prevPayload.provider_order_id,
        sonic_webhook: body,
        webhookAt: new Date().toISOString(),
      },
    });
    if (ok && txn.plan_id) {
      await billing.tryActivateDeviceSubscriptionFromCompletedTxn({
        ...txn,
        status: "completed",
        order_id: merchantOrderId,
      });
    }
    return { status: 200 };
  } catch (e) {
    console.error(LOG_PREFIX, "webhook error", e);
    return { status: 200 };
  }
}

export async function testConnection(cred: SonicpesaCredentials) {
  if (!cred.apiKey) {
    return { ok: false, message: "Missing API key (admin or SONICPESA_API_KEY)." };
  }
  const base = apiBase(cred);
  try {
    const url = `${base}${collectPath()}`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15_000);
    const res = await fetch(url, { method: "OPTIONS", headers: authHeaders(cred), signal: ac.signal });
    clearTimeout(timer);
    if (res.status === 200 || res.status === 204 || res.status === 405) {
      return { ok: true, message: `SonicPesa API reachable at ${base} (HTTP ${res.status}).`, httpStatus: res.status };
    }
    const probe = await httpJson(base, { method: "GET", headers: authHeaders(cred) });
    const authRejected = probe.status === 401 || probe.status === 403;
    return {
      ok: probe.ok || authRejected,
      message: authRejected
        ? `API reachable; auth rejected (HTTP ${probe.status}) — check API key.`
        : probe.ok
          ? `API reachable (HTTP ${probe.status}).`
          : `HTTP ${probe.status}: ${JSON.stringify(probe.body).slice(0, 120)}`,
      httpStatus: probe.status,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error && e.name === "AbortError" ? "Request timed out" : String(e instanceof Error ? e.message : e),
      httpStatus: 0,
    };
  }
}
