import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listDeviceSubscriptions, manageDeviceSubscription } from "@/lib/db/subscriptions-admin";
import { isDbConfigured } from "@/lib/db/client";

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const data = await listDeviceSubscriptions();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const deviceId = String(body.deviceId ?? "").trim();
    const action = String(body.action ?? "").trim() as
      | "extend"
      | "reduce"
      | "remove"
      | "activate"
      | "deactivate";

    if (!deviceId || !action) {
      return NextResponse.json({ success: false, error: "deviceId and action are required" }, { status: 400 });
    }

    const result = await manageDeviceSubscription(deviceId, action, {
      days: body.days != null ? Number(body.days) : undefined,
      hours: body.hours != null ? Number(body.hours) : undefined,
      expiresAt: body.expiresAt,
      planId: body.planId,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
