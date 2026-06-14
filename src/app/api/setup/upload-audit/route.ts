import { NextResponse } from "next/server";
import { getUploadAuditReport, repairUploadAudit } from "@/lib/db/upload-audit";
import { isDbConfigured } from "@/lib/db/client";

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  try {
    const audit = await getUploadAuditReport();
    return NextResponse.json({ success: true, audit });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Upload audit failed" },
      { status: 500 }
    );
  }
}

export async function POST() {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  try {
    const result = await repairUploadAudit();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Repair failed" },
      { status: 500 }
    );
  }
}
