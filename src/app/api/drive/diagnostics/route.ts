import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDriveConfigStatus, runDriveDiagnostics } from "@/lib/google-drive-client";

/** Full Drive diagnostics: folder metadata, permissions, shortcuts, shared drives, upload probe. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const config = getDriveConfigStatus();
  if (!config.configured) {
    return NextResponse.json({ success: false, config, uploadReady: false });
  }

  try {
    const diagnostics = await runDriveDiagnostics();
    return NextResponse.json({ success: diagnostics.uploadReady, ...diagnostics });
  } catch (err) {
    return NextResponse.json({
      success: false,
      config,
      uploadReady: false,
      error: err instanceof Error ? err.message : "Diagnostics failed",
    });
  }
}
