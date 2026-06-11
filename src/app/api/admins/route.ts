import { NextResponse } from "next/server";
import { listAdmins } from "@/lib/db/repository";
import { isDbConfigured } from "@/lib/db/client";

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  try {
    const data = await listAdmins();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
