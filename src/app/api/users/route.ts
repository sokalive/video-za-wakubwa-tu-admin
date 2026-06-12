import { NextResponse } from "next/server";
import { listDeviceUsers, getDeviceUserStats } from "@/lib/db/admin-data";
import { isDbConfigured } from "@/lib/db/client";

export async function GET(request: Request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const isVipParam = searchParams.get("isVip");
    const isActiveParam = searchParams.get("isActive");
    const isVip = isVipParam !== null && isVipParam !== "" ? isVipParam === "true" : undefined;
    const isActive = isActiveParam !== null && isActiveParam !== "" ? isActiveParam === "true" : undefined;

    const [data, stats] = await Promise.all([
      listDeviceUsers({ search, isVip, isActive }),
      getDeviceUserStats(),
    ]);
    return NextResponse.json({ success: true, data, stats });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
