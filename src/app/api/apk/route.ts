import { NextResponse } from "next/server";
import { mockStore } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ success: true, data: mockStore.apk });
}

export async function PUT(request: Request) {
  const body = await request.json();
  mockStore.apk = { ...mockStore.apk, ...body };

  mockStore.activityLogs.unshift({
    id: `log-${Date.now()}`,
    adminId: "admin-1",
    adminName: "Super Admin",
    action: "update",
    entity: "apk",
    entityId: mockStore.apk.id,
    details: `Updated APK to version ${mockStore.apk.version}`,
    ipAddress: "127.0.0.1",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, data: mockStore.apk });
}
