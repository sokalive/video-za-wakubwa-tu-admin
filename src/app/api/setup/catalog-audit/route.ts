import { NextResponse } from "next/server";
import { getCatalogAuditReport, publishAllEligibleVideos } from "@/lib/db/catalog-audit";
import { isDbConfigured } from "@/lib/db/client";

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  try {
    const audit = await getCatalogAuditReport();
    return NextResponse.json({ success: true, audit });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Audit failed" },
      { status: 500 }
    );
  }
}

export async function POST() {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  try {
    const result = await publishAllEligibleVideos();
    const audit = await getCatalogAuditReport();
    return NextResponse.json({ success: true, ...result, audit });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Publish failed" },
      { status: 500 }
    );
  }
}
