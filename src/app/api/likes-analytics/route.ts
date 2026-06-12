import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { listVideoLikeStats } from "@/lib/db/repository";

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const data = await listVideoLikeStats();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Error",
      },
      { status: 500 }
    );
  }
}
