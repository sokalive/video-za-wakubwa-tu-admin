import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { deleteDevicesBulk } from "@/lib/db/admin-cleanup";
import { isDbConfigured } from "@/lib/db/client";

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const deviceIds = Array.isArray(body.deviceIds)
      ? body.deviceIds.map(String).filter(Boolean)
      : [];
    if (deviceIds.length === 0) {
      return NextResponse.json({ success: false, error: "deviceIds array is required" }, { status: 400 });
    }

    const result = await deleteDevicesBulk(deviceIds);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
