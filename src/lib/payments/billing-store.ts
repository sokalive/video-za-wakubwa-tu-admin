import { supabaseRest } from "@/lib/db/rest";
import { durationToDays, type PlanDurationUnit } from "@/lib/duration";
import { computeStackedExpiryFromDuration } from "@/lib/payments/subscription-stacking";

export interface TransactionRow {
  id: number;
  order_id: string;
  external_id: string | null;
  plan_id: string | null;
  phone: string;
  amount: number;
  currency: string;
  status: string;
  raw_payload: Record<string, unknown> | null;
  device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SonicpesaSettingsDbRow {
  id: number;
  enabled: boolean;
  environment: string;
  api_endpoint: string;
  api_key: string;
  account_id: string;
  webhook_url: string;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
  last_webhook_at: string | null;
  last_webhook_event: string;
  last_webhook_order_id: string;
  updated_at: string;
}

export interface BillingStore {
  getTransactionByOrderId(orderId: string): Promise<TransactionRow | null>;
  getTransactionByExternalId(externalId: string): Promise<TransactionRow | null>;
  updateTransactionByOrderId(
    orderId: string,
    patch: { status?: string; external_id?: string | null; raw_payload?: Record<string, unknown> }
  ): Promise<TransactionRow | null>;
  recordSonicpesaWebhookReceived(body: unknown): Promise<void>;
  tryActivateDeviceSubscriptionFromCompletedTxn(txn: TransactionRow): Promise<{
    activated: boolean;
    skipped: boolean;
    reason: string;
    deviceId: string | null;
    orderId: string | null;
    expiresAt?: string;
  }>;
}

export async function getSonicpesaRow(): Promise<SonicpesaSettingsDbRow | null> {
  const { data, error } = await supabaseRest<SonicpesaSettingsDbRow[]>("sonicpesa_settings?id=eq.1&limit=1");
  if (error) throw new Error(error);
  return data?.[0] ?? null;
}

export async function updateSonicpesaRowFull(d: {
  enabled: boolean;
  environment: string;
  api_endpoint: string;
  account_id: string;
  webhook_url: string;
  keep_api_key: boolean;
  api_key: string;
  last_test_at?: string | null;
  last_test_ok?: boolean | null;
  last_test_message?: string | null;
}): Promise<SonicpesaSettingsDbRow> {
  const current = await getSonicpesaRow();
  const row = {
    id: 1,
    enabled: d.enabled,
    environment: d.environment,
    api_endpoint: d.api_endpoint,
    account_id: d.account_id,
    webhook_url: d.webhook_url,
    api_key: d.keep_api_key ? (current?.api_key ?? "") : d.api_key,
    last_test_at: d.last_test_at ?? current?.last_test_at ?? null,
    last_test_ok: d.last_test_ok ?? current?.last_test_ok ?? null,
    last_test_message: d.last_test_message ?? current?.last_test_message ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseRest<SonicpesaSettingsDbRow[]>("sonicpesa_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });
  if (error) throw new Error(error);
  const saved = data?.[0];
  if (!saved) throw new Error("Failed to save SonicPesa settings");
  return saved;
}

export async function recordSonicpesaWebhookReceived(body: unknown): Promise<void> {
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const event = String(o.event ?? o.type ?? "").trim().slice(0, 128);
  const orderId = String(o.order_id ?? o.orderId ?? o.merchant_order_id ?? "").trim().slice(0, 128);
  const current = await getSonicpesaRow();
  await updateSonicpesaRowFull({
    enabled: Boolean(current?.enabled),
    environment: current?.environment ?? "sandbox",
    api_endpoint: current?.api_endpoint ?? "",
    account_id: current?.account_id ?? "",
    webhook_url: current?.webhook_url ?? "",
    keep_api_key: true,
    api_key: "",
    last_test_at: current?.last_test_at ?? null,
    last_test_ok: current?.last_test_ok ?? null,
    last_test_message: current?.last_test_message ?? null,
  });
  await supabaseRest("sonicpesa_settings?id=eq.1", {
    method: "PATCH",
    body: JSON.stringify({
      last_webhook_at: new Date().toISOString(),
      last_webhook_event: event,
      last_webhook_order_id: orderId,
      updated_at: new Date().toISOString(),
    }),
  });
}

export type CheckoutProvider = "legacy" | "sonicpesa";

export async function getCheckoutPaymentSettings(): Promise<{ payment_provider: CheckoutProvider; updated_at: string | null }> {
  const { data, error } = await supabaseRest<{ payment_provider: string; updated_at: string }[]>(
    "checkout_payment_settings?id=eq.1&limit=1"
  );
  if (error) throw new Error(error);
  const row = data?.[0];
  const p = String(row?.payment_provider ?? "legacy").trim().toLowerCase();
  return {
    payment_provider: p === "sonicpesa" ? "sonicpesa" : "legacy",
    updated_at: row?.updated_at ?? null,
  };
}

export async function updateCheckoutPaymentProvider(paymentProvider: CheckoutProvider) {
  const { data, error } = await supabaseRest<{ payment_provider: string; updated_at: string }[]>(
    "checkout_payment_settings",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ id: 1, payment_provider: paymentProvider, updated_at: new Date().toISOString() }),
    }
  );
  if (error) throw new Error(error);
  const row = data?.[0];
  return {
    payment_provider: (row?.payment_provider === "sonicpesa" ? "sonicpesa" : "legacy") as CheckoutProvider,
    updated_at: row?.updated_at ?? null,
  };
}

export async function insertTransaction(row: {
  order_id: string;
  external_id?: string | null;
  plan_id: string;
  phone: string;
  amount: number;
  currency?: string;
  status?: string;
  device_id?: string | null;
  raw_payload?: Record<string, unknown>;
}): Promise<TransactionRow> {
  const payload = {
    order_id: row.order_id,
    external_id: row.external_id ?? null,
    plan_id: row.plan_id,
    phone: row.phone,
    amount: row.amount,
    currency: row.currency ?? "TZS",
    status: row.status ?? "pending",
    device_id: row.device_id ?? null,
    raw_payload: row.raw_payload ?? {},
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseRest<TransactionRow[]>("transactions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (error) throw new Error(error);
  const saved = data?.[0];
  if (!saved) throw new Error("Failed to insert transaction");
  return saved;
}

export async function getTransactionByOrderId(orderId: string): Promise<TransactionRow | null> {
  const { data, error } = await supabaseRest<TransactionRow[]>(
    `transactions?order_id=eq.${encodeURIComponent(String(orderId))}&limit=1`
  );
  if (error) throw new Error(error);
  return data?.[0] ?? null;
}

export async function getTransactionByExternalId(externalId: string): Promise<TransactionRow | null> {
  const id = String(externalId ?? "").trim();
  if (!id) return null;
  const { data, error } = await supabaseRest<TransactionRow[]>(
    `transactions?external_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=1`
  );
  if (error) throw new Error(error);
  return data?.[0] ?? null;
}

export async function updateTransactionByOrderId(
  orderId: string,
  patch: { status?: string; external_id?: string | null; raw_payload?: Record<string, unknown> }
): Promise<TransactionRow | null> {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status != null) body.status = patch.status;
  if (patch.external_id !== undefined) body.external_id = patch.external_id;
  if (patch.raw_payload !== undefined) body.raw_payload = patch.raw_payload;
  const { data, error } = await supabaseRest<TransactionRow[]>(
    `transactions?order_id=eq.${encodeURIComponent(String(orderId))}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    }
  );
  if (error) throw new Error(error);
  return data?.[0] ?? null;
}

export async function listTransactionsAdmin(filters: { status?: string } = {}) {
  let path = "transactions?select=*,vip_plans(name)&order=created_at.desc";
  if (filters.status && filters.status !== "all") {
    path += `&status=eq.${encodeURIComponent(filters.status)}`;
  }
  const { data, error } = await supabaseRest<
    (TransactionRow & { vip_plans: { name: string } | null })[]
  >(path);
  if (error) throw new Error(error);
  return data ?? [];
}

async function getVipPlanDuration(planId: string): Promise<{ value: number; unit: PlanDurationUnit }> {
  const { data, error } = await supabaseRest<
    { duration_days: number; duration_value: number; duration_unit: string }[]
  >(`vip_plans?id=eq.${encodeURIComponent(planId)}&limit=1`);
  if (error) throw new Error(error);
  const plan = data?.[0];
  if (!plan) return { value: 30, unit: "days" };
  if (plan.duration_value && plan.duration_unit) {
    return {
      value: plan.duration_value,
      unit: plan.duration_unit as PlanDurationUnit,
    };
  }
  return { value: Math.max(1, Number(plan.duration_days) || 30), unit: "days" };
}

async function deviceSubscriptionOrderAlreadyApplied(orderId: string): Promise<boolean> {
  const { data, error } = await supabaseRest<{ device_id: string }[]>(
    `device_subscriptions?transaction_id=eq.${encodeURIComponent(String(orderId).trim())}&limit=1`
  );
  if (error) throw new Error(error);
  return (data?.length ?? 0) > 0;
}

async function getDeviceSubscription(deviceId: string) {
  const { data, error } = await supabaseRest<{ expires_at: string }[]>(
    `device_subscriptions?device_id=eq.${encodeURIComponent(deviceId)}&limit=1`
  );
  if (error) throw new Error(error);
  return data?.[0] ?? null;
}

async function upsertDeviceSubscriptionActive({
  deviceId,
  orderId,
  expiresAt,
}: {
  deviceId: string;
  orderId: string;
  expiresAt: string;
}): Promise<{ skipped: boolean }> {
  const d = String(deviceId ?? "").trim();
  const oid = String(orderId ?? "").trim();
  if (!d || !oid) throw new Error("deviceId and orderId required");
  if (await deviceSubscriptionOrderAlreadyApplied(oid)) {
    return { skipped: true };
  }
  const existing = await getDeviceSubscription(d);
  const now = new Date().toISOString();
  const startedAt =
    existing?.expires_at && new Date(existing.expires_at).getTime() > Date.now()
      ? undefined
      : now;
  const row: Record<string, unknown> = {
    device_id: d,
    status: "active",
    expires_at: expiresAt,
    transaction_id: oid,
    updated_at: now,
  };
  if (startedAt) row.started_at = startedAt;
  const { error } = await supabaseRest("device_subscriptions", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });
  if (error) {
    if (/duplicate|unique/i.test(error)) return { skipped: true };
    throw new Error(error);
  }
  return { skipped: false };
}

async function computeDeviceSubscriptionExpiryAfterPurchase(
  deviceId: string,
  duration: { value: number; unit: PlanDurationUnit }
) {
  const existing = await getDeviceSubscription(deviceId);
  return computeStackedExpiryFromDuration(
    existing?.expires_at ?? null,
    duration.value,
    duration.unit
  );
}

export async function tryActivateDeviceSubscriptionFromCompletedTxn(txn: TransactionRow) {
  if (!txn || String(txn.status ?? "").trim() !== "completed") {
    return { activated: false, skipped: true, reason: "not_completed", deviceId: null, orderId: txn?.order_id ?? null };
  }
  const planId = txn.plan_id;
  if (!planId) {
    return { activated: false, skipped: true, reason: "no_plan", deviceId: null, orderId: String(txn.order_id ?? "") };
  }
  let deviceId = String(txn.device_id ?? "").trim();
  const raw = txn.raw_payload && typeof txn.raw_payload === "object" ? txn.raw_payload : {};
  if (!deviceId) deviceId = String(raw.device_id ?? "").trim();
  const orderId = String(txn.order_id ?? "").trim();
  if (!deviceId) {
    return { activated: false, skipped: true, reason: "no_device_id", deviceId: null, orderId };
  }
  const duration = await getVipPlanDuration(planId);
  const stack = await computeDeviceSubscriptionExpiryAfterPurchase(deviceId, duration);
  const { skipped } = await upsertDeviceSubscriptionActive({
    deviceId,
    orderId,
    expiresAt: stack.expiresAt,
  });
  return {
    activated: !skipped,
    skipped,
    reason: skipped ? "already_applied" : "ok",
    deviceId,
    orderId,
    expiresAt: stack.expiresAt,
  };
}

export async function getDeviceSubscriptionStatus(deviceId: string) {
  const d = String(deviceId ?? "").trim();
  if (!d) return null;
  const { data, error } = await supabaseRest<
    { device_id: string; status: string; expires_at: string; transaction_id: string }[]
  >(`device_subscriptions?device_id=eq.${encodeURIComponent(d)}&limit=1`);
  if (error) throw new Error(error);
  const row = data?.[0];
  if (!row) return null;
  const active = row.status === "active" && new Date(row.expires_at).getTime() > Date.now();
  return { ...row, active };
}

export const billingStore: BillingStore = {
  getTransactionByOrderId,
  getTransactionByExternalId,
  updateTransactionByOrderId,
  recordSonicpesaWebhookReceived,
  tryActivateDeviceSubscriptionFromCompletedTxn,
};
