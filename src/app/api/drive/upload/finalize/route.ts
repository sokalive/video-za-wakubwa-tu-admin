import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { finalizeDriveUpload, isGoogleDriveUploadConfigured } from "@/lib/google-drive-client";
import { isValidGoogleDriveUrl } from "@/lib/google-drive";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isGoogleDriveUploadConfigured()) {
    return NextResponse.json(
      { success: false, error: "Google Drive upload is not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const fileId = String(body.fileId ?? "").trim();

    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      return NextResponse.json({ success: false, error: "Valid fileId is required" }, { status: 400 });
    }

    const shareUrl = await finalizeDriveUpload(fileId);

    if (!isValidGoogleDriveUrl(shareUrl)) {
      return NextResponse.json({ success: false, error: "Invalid share URL generated" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      fileId,
      url: shareUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to finalize upload" },
      { status: 500 }
    );
  }
}
