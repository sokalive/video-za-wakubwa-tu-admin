import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { setVideoPin } from "@/lib/db/repository";
import { isDbConfigured } from "@/lib/db/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const pinned = Boolean(body.pinned);
    const pinOrder =
      body.pinOrder === null || body.pinOrder === undefined
        ? undefined
        : Number(body.pinOrder);

    if (pinOrder !== undefined && (!Number.isFinite(pinOrder) || pinOrder < 1)) {
      return NextResponse.json({ success: false, error: "pinOrder must be a positive number" }, { status: 400 });
    }

    const video = await setVideoPin(
      id,
      { pinned, pinOrder },
      session.adminId,
      session.name
    );
    return NextResponse.json({ success: true, data: video });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
