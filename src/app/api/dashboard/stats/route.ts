import { NextResponse } from "next/server";
import { computeDashboardStats } from "@/lib/db/repository";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db/client";

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  try {
    const data = await computeDashboardStats(getSupabaseAdmin());
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
