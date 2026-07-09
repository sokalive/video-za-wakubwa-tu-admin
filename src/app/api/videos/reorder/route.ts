import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isDbConfigured } from "@/lib/db/client";
import { reorderVideos } from "@/lib/db/video-order";
import { logActivity } from "@/lib/db/repository";

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(String) : [];
    const result = await reorderVideos(orderedIds, session.adminId, session.name);
    await logActivity(
      session.adminId,
      session.name,
      "update",
      "video",
      `Reordered ${result.updated} videos`,
      "catalog"
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Reorder failed" },
      { status: 400 }
    );
  }
}
