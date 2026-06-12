import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  createResumableUploadSession,
  getDriveConfigStatus,
  isAllowedVideoFile,
  MAX_VIDEO_BYTES,
  probeDriveFolder,
  resolveBrowserUploadOrigin,
} from "@/lib/google-drive-client";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const driveStatus = getDriveConfigStatus();

  if (!driveStatus.configured) {
    return NextResponse.json(
      {
        success: false,
        error: driveStatus.reason ?? "Google Drive upload is not configured.",
        ...driveStatus,
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const fileName = String(body.fileName ?? "").trim();
    const mimeType = String(body.mimeType ?? "application/octet-stream");
    const fileSize = Number(body.fileSize ?? 0);
    const browserOrigin = resolveBrowserUploadOrigin(
      request,
      typeof body.uploadOrigin === "string" ? body.uploadOrigin : null
    );

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

    if (!browserOrigin) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not determine admin panel origin for Google Drive CORS. Set NEXT_PUBLIC_APP_URL on Vercel or pass uploadOrigin from the browser.",
        },
        { status: 400 }
      );
    }

    const uploadUrl = await createResumableUploadSession(fileName, mimeType, {
      browserOrigin,
      fileSize,
    });

    return NextResponse.json({
      success: true,
      uploadUrl,
      fileName,
      fileSize,
      browserOrigin,
    });
  } catch (err) {
    let folderProbe = null;
    try {
      folderProbe = await probeDriveFolder();
    } catch {
      // ignore secondary probe failure
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create upload session",
        folderProbe,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const driveStatus = getDriveConfigStatus();

  let folderProbe = null;
  if (driveStatus.configured) {
    try {
      folderProbe = await probeDriveFolder();
    } catch {
      folderProbe = null;
    }
  }

  return NextResponse.json({
    success: true,
    ...driveStatus,
    folderAccessible: folderProbe?.ok ?? false,
    folderName: folderProbe?.folderName ?? null,
    folderProbe,
    maxBytes: MAX_VIDEO_BYTES,
  });
}
