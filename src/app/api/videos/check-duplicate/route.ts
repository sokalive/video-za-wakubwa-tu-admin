import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { findDuplicateVideo } from "@/lib/db/repository";
import { isDbConfigured } from "@/lib/db/client";

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const duplicate = await findDuplicateVideo({
      fileHash: body.fileHash,
      r2ObjectKey: body.r2ObjectKey,
      videoUrl: body.videoUrl,
      fileSize: body.fileSize,
    });

    return NextResponse.json({ success: true, duplicate });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
