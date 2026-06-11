import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  createResumableUploadSession,
  isGoogleDriveUploadConfigured,
  isAllowedVideoFile,
  MAX_VIDEO_BYTES,
  getServiceAccountEmail,
} from "@/lib/google-drive-client";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isGoogleDriveUploadConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: "Google Drive upload is not configured. Set GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_FOLDER_ID on Vercel.",
        serviceAccountEmail: getServiceAccountEmail(),
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const fileName = String(body.fileName ?? "").trim();
    const mimeType = String(body.mimeType ?? "application/octet-stream");
    const fileSize = Number(body.fileSize ?? 0);

    if (!fileName) {
      return NextResponse.json({ success: false, error: "fileName is required" }, { status: 400 });
    }

    if (!fileSize || fileSize <= 0) {
      return NextResponse.json({ success: false, error: "fileSize must be greater than 0" }, { status: 400 });
    }

    if (fileSize > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { success: false, error: `File exceeds maximum size of ${MAX_VIDEO_BYTES / (1024 * 1024 * 1024)} GB` },
        { status: 400 }
      );
    }

    if (!isAllowedVideoFile(fileName, mimeType)) {
      return NextResponse.json(
        { success: false, error: "Unsupported video format. Use MP4, WebM, MOV, AVI, or MKV." },
        { status: 400 }
      );
    }

    const uploadUrl = await createResumableUploadSession(fileName, mimeType);

    return NextResponse.json({
      success: true,
      uploadUrl,
      fileName,
      fileSize,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to create upload session" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    configured: isGoogleDriveUploadConfigured(),
    serviceAccountEmail: getServiceAccountEmail(),
    maxBytes: MAX_VIDEO_BYTES,
  });
}
