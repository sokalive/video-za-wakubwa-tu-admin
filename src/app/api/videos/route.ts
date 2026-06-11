import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listVideos, createVideo } from "@/lib/db/repository";
import { isDbConfigured } from "@/lib/db/client";

export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const isVipParam = searchParams.get("isVip");
    const isVip = isVipParam !== null && isVipParam !== "" ? isVipParam === "true" : undefined;

    const videos = await listVideos({ search, category, isVip });
    return NextResponse.json({ success: true, data: videos });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const video = await createVideo(body, session.adminId, session.name);
    return NextResponse.json({ success: true, data: video }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
