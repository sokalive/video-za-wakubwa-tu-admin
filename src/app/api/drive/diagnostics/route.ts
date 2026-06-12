import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getDriveConfigStatus,
  probeDriveFolder,
} from "@/lib/google-drive-client";

/** Live diagnostics with full Drive API request/response traces. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const config = getDriveConfigStatus();

  if (!config.configured) {
    return NextResponse.json({
      success: false,
      config,
      folderProbe: null,
      uploadReady: false,
    });
  }

  try {
    const folderProbe = await probeDriveFolder();

    return NextResponse.json({
      success: true,
      config,
      folderProbe,
      uploadReady: folderProbe.ok,
      filesGetRequest: folderProbe.apiTrace,
      uploadSessionRequest: folderProbe.uploadSessionTrace,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      config,
      folderProbe: null,
      uploadReady: false,
      error: err instanceof Error ? err.message : "Diagnostics failed",
    });
  }
}
