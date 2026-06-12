import {
  getTransactionByOrderId,
  updateTransactionByOrderId,
  tryActivateDeviceSubscriptionFromCompletedTxn,
} from "@/lib/payments/billing-store";
import { resolveSonicpesaCredentials, verifyPayment } from "@/lib/payments/providers/sonicpesa";
import { getSonicpesaRow } from "@/lib/payments/billing-store";
import { webhookExplicitFailure, webhookSuccess } from "@/lib/payments/webhook-status";

export async function reconcileSonicpesaOrder(orderId: string) {
  const oid = String(orderId ?? "").trim();
  const out = {
    orderId: oid,
    phase: "start",
    txnStatusBefore: null as string | null,
    txnStatusAfter: null as string | null,
    providerHttpOk: null as boolean | null,
    transitionedToCompleted: false,
    activation: null as Awaited<ReturnType<typeof tryActivateDeviceSubscriptionFromCompletedTxn>> | null,
  };

  if (!oid) {
    out.phase = "missing_order_id";
    return out;
  }

  let txn = await getTransactionByOrderId(oid);
  if (!txn) {
    out.phase = "txn_not_found";
    return out;
  }

  out.txnStatusBefore = String(txn.status ?? "");

  if (txn.status === "completed") {
    out.phase = "already_completed_activate";
    const act = await tryActivateDeviceSubscriptionFromCompletedTxn(txn);
    out.activation = act;
    out.txnStatusAfter = "completed";
    return out;
  }

  if (txn.status === "failed") {
    out.phase = "already_failed";
    out.txnStatusAfter = "failed";
    return out;
  }

  if (txn.status !== "pending") {
    out.phase = "unexpected_status";
    out.txnStatusAfter = String(txn.status ?? "");
    return out;
  }

  const rawPayload = txn.raw_payload && typeof txn.raw_payload === "object" ? txn.raw_payload : {};
  if (rawPayload.payment_provider !== "sonicpesa") {
    out.phase = "not_sonicpesa";
    return out;
  }

  const srow = await getSonicpesaRow();
  const scred = resolveSonicpesaCredentials(srow || {});
  const verifyId = String(rawPayload.provider_order_id ?? txn.external_id ?? oid).trim();
  const z = await verifyPayment(scred, verifyId);
  out.providerHttpOk = z.ok === true;

  if (!z.ok || z.body == null) {
    out.phase = "provider_request_failed";
    return out;
  }

  const body = z.body;
  const ok = z.normalized?.succeeded === true || webhookSuccess(body);
  const fail = z.normalized?.failed === true || webhookExplicitFailure(body);
  const nextStatus = ok ? "completed" : fail ? "failed" : txn.status;

  if (nextStatus === txn.status) {
    out.phase = "still_pending_or_unknown";
    return out;
  }

  const prevPayload = txn.raw_payload && typeof txn.raw_payload === "object" ? txn.raw_payload : {};
  const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  await updateTransactionByOrderId(oid, {
    status: nextStatus,
    external_id:
      bodyObj.transaction_id != null ? String(bodyObj.transaction_id) : txn.external_id,
    raw_payload: {
      ...prevPayload,
      order_status_poll: body,
      orderStatusPolledAt: new Date().toISOString(),
    },
  });

  out.transitionedToCompleted = nextStatus === "completed";
  out.txnStatusAfter = nextStatus;
  out.phase = nextStatus === "completed" ? "transitioned_completed" : "transitioned_failed";

  if (nextStatus === "completed") {
    txn = (await getTransactionByOrderId(oid))!;
    const act = await tryActivateDeviceSubscriptionFromCompletedTxn({ ...txn, status: "completed" });
    out.activation = act;
  }

  return out;
}
