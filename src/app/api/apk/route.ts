import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getApk, listApkHistory, updateApk } from "@/lib/db/repository";
import { isDbConfigured } from "@/lib/db/client";

export async function GET(request: Request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  try {
    const history = new URL(request.url).searchParams.get("history") === "1";
    if (history) {
      const data = await listApkHistory();
      return NextResponse.json({ success: true, data });
    }
    const data = await getApk();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const data = await updateApk(body, session.adminId, session.name);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
