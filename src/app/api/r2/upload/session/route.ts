import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createR2UploadSession, getR2Status } from "@/lib/r2-client";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const r2Status = getR2Status();
  if (!r2Status.configured) {
    return NextResponse.json(
      { success: false, error: r2Status.reason ?? "R2 is not configured.", ...r2Status },
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

    const sessionInfo = await createR2UploadSession(fileName, mimeType, fileSize);

    return NextResponse.json({
      success: true,
      ...sessionInfo,
      fileName,
      fileSize,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to create R2 upload session" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ success: true, ...getR2Status() });
}
