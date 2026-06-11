import { NextResponse } from "next/server";
import { mockStore } from "@/lib/mock-data";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const index = mockStore.ads.findIndex((a) => a.id === id);

  if (index === -1) {
    return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 });
  }

  mockStore.ads[index] = { ...mockStore.ads[index], ...body };
  return NextResponse.json({ success: true, data: mockStore.ads[index] });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = mockStore.ads.findIndex((a) => a.id === id);

  if (index === -1) {
    return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 });
  }

  mockStore.ads.splice(index, 1);
  return NextResponse.json({ success: true });
}
