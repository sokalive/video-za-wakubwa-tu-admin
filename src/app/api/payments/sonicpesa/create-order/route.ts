import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { supabaseRest } from "@/lib/db/rest";
import { formatPhoneE164, normalizePhoneDigits } from "@/lib/payments/billing-normalize";
import {
  getSonicpesaRow,
  insertTransaction,
  updateTransactionByOrderId,
} from "@/lib/payments/billing-store";
import { createOrder, resolveSonicpesaCredentials } from "@/lib/payments/providers/sonicpesa";

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  try {
    const b = await request.json();
    const planId = String(b.planId ?? b.plan_id ?? "").trim();
    const deviceId = String(b.deviceId ?? b.device_id ?? "").trim();
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required (client device identifier)" }, { status: 400 });
    }
    const phone = normalizePhoneDigits(String(b.phone ?? "").trim());
    if (!phone || !planId) {
      return NextResponse.json({ error: "phone and planId are required" }, { status: 400 });
    }
    const phoneE164 = formatPhoneE164(phone);
    if (!phoneE164.startsWith("+255") || phoneE164.length < 13) {
      return NextResponse.json({ error: "phone must be a valid Tanzania number (+255…)" }, { status: 400 });
    }

    const { data: plans, error: planError } = await supabaseRest<
      { id: string; name: string; price: number; is_active: boolean }[]
    >(`vip_plans?id=eq.${encodeURIComponent(planId)}&limit=1`);
    if (planError) throw new Error(planError);
    const plan = plans?.[0];
    if (!plan || !plan.is_active) {
      return NextResponse.json({ error: "Plan not found or inactive" }, { status: 400 });
    }

    const row = await getSonicpesaRow();
    if (!row || row.enabled !== true) {
      return NextResponse.json({ error: "SonicPesa is disabled or not configured in admin" }, { status: 503 });
    }
    const cred = resolveSonicpesaCredentials(row);
    if (!cred.apiKey) {
      return NextResponse.json({ error: "SonicPesa credentials incomplete (admin or env)" }, { status: 503 });
    }

    const orderId = `vzw_sp_${Date.now()}_${randomBytes(5).toString("hex")}`;
    const amount = Number(plan.price);
    const tx = await insertTransaction({
      order_id: orderId,
      plan_id: planId,
      phone: phoneE164,
      amount,
      currency: "TZS",
      status: "pending",
      device_id: deviceId,
      raw_payload: {
        step: "created",
        payment_provider: "sonicpesa",
        phoneNorm: phone,
        device_id: deviceId,
      },
    });

    const sp = await createOrder(cred, { phone, amount, orderId, currency: "TZS" });
    const providerOrderId =
      sp.normalized?.providerOrderId ??
      (sp.body &&
      typeof sp.body === "object" &&
      (sp.body as Record<string, unknown>).data &&
      typeof (sp.body as Record<string, unknown>).data === "object"
        ? String(((sp.body as Record<string, unknown>).data as Record<string, unknown>).order_id ?? "")
        : null);

    const prevPayload = tx.raw_payload && typeof tx.raw_payload === "object" ? tx.raw_payload : {};
    await updateTransactionByOrderId(orderId, {
      status: sp.ok ? "pending" : "failed",
      external_id: providerOrderId,
      raw_payload: {
        ...prevPayload,
        sonicpesa: sp.body,
        provider_order_id: providerOrderId,
        httpStatus: sp.status,
      },
    });

    if (!sp.ok) {
      return NextResponse.json(
        {
          error: "SonicPesa payment initiation failed",
          orderId,
          transactionId: tx.id,
          httpStatus: sp.status,
          request: sp.requestPayload,
          details: sp.body,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        provider: "sonicpesa",
        orderId,
        provider_order_id: providerOrderId,
        deviceId,
        transactionId: tx.id,
        amount,
        currency: "TZS",
        sonicpesa: sp.body,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
