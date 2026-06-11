import { NextResponse } from "next/server";
import { updateCategory, deleteCategory } from "@/lib/db/repository";
import { isDbConfigured } from "@/lib/db/client";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  try {
    const { id } = await params;
    const body = await request.json();
    const data = await updateCategory(id, body);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  try {
    const { id } = await params;
    await deleteCategory(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
