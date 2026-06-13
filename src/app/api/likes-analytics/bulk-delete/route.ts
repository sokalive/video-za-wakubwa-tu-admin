import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resetVideoLikesBulk } from "@/lib/db/admin-cleanup";
import { isDbConfigured } from "@/lib/db/client";

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const videoIds = Array.isArray(body.videoIds)
      ? body.videoIds.map(String).filter(Boolean)
      : [];
    if (videoIds.length === 0) {
      return NextResponse.json({ success: false, error: "videoIds array is required" }, { status: 400 });
    }

    const result = await resetVideoLikesBulk(videoIds);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
