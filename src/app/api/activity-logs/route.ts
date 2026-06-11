import { NextResponse } from "next/server";
import { mockStore } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ success: true, data: mockStore.activityLogs });
}
