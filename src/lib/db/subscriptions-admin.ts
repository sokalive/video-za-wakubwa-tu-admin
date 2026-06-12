import { supabaseRest } from "./rest";
import { durationToMs, type PlanDurationUnit } from "@/lib/duration";
import { computeStackedExpiryFromDuration } from "@/lib/payments/subscription-stacking";

export interface DeviceSubscriptionRow {
  deviceId: string;
  status: "active" | "pending";
  expiresAt: string;
  startedAt: string;
  transactionId: string;
  updatedAt: string;
  active: boolean;
  phone?: string;
  totalSpent: number;
}

export async function listDeviceSubscriptions(): Promise<DeviceSubscriptionRow[]> {
  const [subs, txns] = await Promise.all([
    supabaseRest<
      {
        device_id: string;
        status: string;
        expires_at: string;
        started_at: string;
        transaction_id: string;
        updated_at: string;
      }[]
    >("device_subscriptions?select=*&order=expires_at.desc"),
    supabaseRest<{ device_id: string | null; phone: string; amount: number; status: string }[]>(
      "transactions?select=device_id,phone,amount,status"
    ),
  ]);

  if (subs.error) throw new Error(subs.error);

  const phoneByDevice = new Map<string, string>();
  const spentByDevice = new Map<string, number>();
  for (const t of txns.data ?? []) {
    if (!t.device_id) continue;
    if (t.phone && !phoneByDevice.has(t.device_id)) phoneByDevice.set(t.device_id, t.phone);
    if (t.status === "completed") {
      spentByDevice.set(t.device_id, (spentByDevice.get(t.device_id) ?? 0) + t.amount);
    }
  }

  const now = Date.now();
  return (subs.data ?? []).map((s) => ({
    deviceId: s.device_id,
    status: s.status as "active" | "pending",
    expiresAt: s.expires_at,
    startedAt: s.started_at,
    transactionId: s.transaction_id,
    updatedAt: s.updated_at,
    active: s.status === "active" && new Date(s.expires_at).getTime() > now,
    phone: phoneByDevice.get(s.device_id),
    totalSpent: spentByDevice.get(s.device_id) ?? 0,
  }));
}

export async function manageDeviceSubscription(
  deviceId: string,
  action: "extend" | "reduce" | "remove" | "activate" | "deactivate",
  opts?: { days?: number; hours?: number; expiresAt?: string; planId?: string }
) {
  const d = String(deviceId ?? "").trim();
  if (!d) throw new Error("deviceId is required");

  const { data, error } = await supabaseRest<
    {
      device_id: string;
      status: string;
      expires_at: string;
      transaction_id: string;
    }[]
  >(`device_subscriptions?device_id=eq.${encodeURIComponent(d)}&limit=1`);

  if (error) throw new Error(error);
  const existing = data?.[0];
  const now = new Date();
  const nowIso = now.toISOString();

  if (action === "remove") {
    if (!existing) return { removed: true, deviceId: d };
    const { error: delErr } = await supabaseRest(
      `device_subscriptions?device_id=eq.${encodeURIComponent(d)}`,
      { method: "DELETE" }
    );
    if (delErr) throw new Error(delErr);
    return { removed: true, deviceId: d };
  }

  const adjustMs = (base: Date, deltaMs: number) => new Date(base.getTime() + deltaMs).toISOString();

  if (action === "deactivate") {
    const patch = {
      status: "pending",
      expires_at: nowIso,
      updated_at: nowIso,
    };
    if (existing) {
      await supabaseRest(`device_subscriptions?device_id=eq.${encodeURIComponent(d)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    }
    return { deviceId: d, status: "pending", expiresAt: nowIso };
  }

  if (action === "activate") {
    let expiresAt = opts?.expiresAt;
    if (!expiresAt && opts?.planId) {
      const plan = await supabaseRest<
        { duration_value: number; duration_unit: string; duration_days: number }[]
      >(`vip_plans?id=eq.${encodeURIComponent(opts.planId)}&limit=1`);
      if (plan.error) throw new Error(plan.error);
      const p = plan.data?.[0];
      const value = p?.duration_value ?? p?.duration_days ?? 1;
      const unit = (p?.duration_unit ?? "days") as PlanDurationUnit;
      expiresAt = computeStackedExpiryFromDuration(existing?.expires_at ?? null, value, unit).expiresAt;
    }
    if (!expiresAt) {
      const days = opts?.days ?? 1;
      const ms = durationToMs(days, "days");
      expiresAt = adjustMs(
        existing?.expires_at && new Date(existing.expires_at) > now ? new Date(existing.expires_at) : now,
        ms
      );
    }
    const txnId = existing?.transaction_id ?? `admin-manual-${Date.now()}`;
    const row = {
      device_id: d,
      status: "active",
      expires_at: expiresAt,
      transaction_id: txnId,
      updated_at: nowIso,
      started_at: existing ? undefined : nowIso,
    };
    await supabaseRest("device_subscriptions", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(row),
    });
    return { deviceId: d, status: "active", expiresAt };
  }

  if (!existing) throw new Error("No subscription found for this device");

  const base = new Date(existing.expires_at);
  const anchor = base.getTime() > now.getTime() ? base : now;

  if (action === "extend") {
    const days = opts?.days ?? 1;
    const hours = opts?.hours ?? 0;
    const deltaMs = durationToMs(days, "days") + hours * 3600 * 1000;
    const expiresAt = adjustMs(anchor, deltaMs);
    await supabaseRest(`device_subscriptions?device_id=eq.${encodeURIComponent(d)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active", expires_at: expiresAt, updated_at: nowIso }),
    });
    return { deviceId: d, status: "active", expiresAt };
  }

  if (action === "reduce") {
    const days = opts?.days ?? 1;
    const hours = opts?.hours ?? 0;
    const deltaMs = durationToMs(days, "days") + hours * 3600 * 1000;
    const expiresAt = adjustMs(anchor, -deltaMs);
    const patch: Record<string, string> = { expires_at: expiresAt, updated_at: nowIso };
    if (new Date(expiresAt).getTime() <= now.getTime()) patch.status = "pending";
    await supabaseRest(`device_subscriptions?device_id=eq.${encodeURIComponent(d)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { deviceId: d, expiresAt, status: patch.status ?? existing.status };
  }

  throw new Error("Unknown action");
}
