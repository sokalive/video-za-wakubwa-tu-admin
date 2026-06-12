function walkPaymentPayloadObjects(body: unknown): Record<string, unknown>[] {
  if (body == null || typeof body !== "object") return [];
  const out: Record<string, unknown>[] = [];
  const push = (x: unknown) => {
    if (x && typeof x === "object" && !Array.isArray(x)) out.push(x as Record<string, unknown>);
  };
  const b = body as Record<string, unknown>;
  push(b);
  push(b.data);
  push(b.payload);
  push(b.payment);
  push(b.transaction);
  if (Array.isArray(b.data)) {
    for (const item of b.data) push(item);
  }
  return out;
}

const PENDING_LIKE = new Set([
  "pending", "processing", "initiated", "created", "sent", "waiting", "queued",
  "submitted", "partial", "in_progress", "inprogress", "awaiting", "open", "new",
]);

const SETTLED = new Set([
  "completed", "paid", "success", "successful", "succeeded", "ok", "confirmed", "captured", "complete",
]);

function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

function isPendingLike(s: unknown): boolean {
  return PENDING_LIKE.has(norm(s));
}

function isSettledField(s: unknown): boolean {
  const v = norm(s);
  if (!v || isPendingLike(v)) return false;
  return SETTLED.has(v);
}

function isConservativeGenericPaid(s: unknown): boolean {
  const v = norm(s);
  return v === "completed" || v === "paid";
}

export function webhookSuccess(body: unknown): boolean {
  const objs = walkPaymentPayloadObjects(body);
  for (const o of objs) {
    for (const pk of ["payment_status", "PaymentStatus", "paymentStatus"]) {
      if (!(pk in o)) continue;
      const raw = o[pk];
      if (raw == null || raw === "") continue;
      if (isSettledField(raw)) return true;
    }
  }
  for (const o of objs) {
    for (const gk of ["status", "state", "result"]) {
      if (!(gk in o)) continue;
      const raw = o[gk];
      if (raw == null || raw === "") continue;
      if (isPendingLike(raw)) continue;
      if (isConservativeGenericPaid(raw)) return true;
    }
  }
  const b = body as Record<string, unknown>;
  if (b?.paid === true) return true;
  const d = b?.data;
  if (d && typeof d === "object" && !Array.isArray(d) && (d as Record<string, unknown>).paid === true) {
    return true;
  }
  return false;
}

function statusStringsFromWebhook(body: unknown): string[] {
  const objs = walkPaymentPayloadObjects(body);
  const keys = ["payment_status", "status", "state", "result"];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const o of objs) {
    for (const k of keys) {
      const v = o[k];
      if (v == null || v === "") continue;
      const s = String(v).trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out;
}

export function webhookExplicitFailure(body: unknown): boolean {
  for (const raw of statusStringsFromWebhook(body)) {
    const s = raw.toLowerCase();
    if (["failed", "error", "declined", "cancelled", "rejected"].includes(s)) return true;
  }
  const b = body as Record<string, unknown>;
  if (b?.success === false || b?.paid === false) return true;
  const d = b?.data;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const dd = d as Record<string, unknown>;
    if (dd.success === false || dd.paid === false) return true;
  }
  return false;
}
