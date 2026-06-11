import { NextResponse } from "next/server";
import { mockStore } from "@/lib/mock-data";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const index = mockStore.categories.findIndex((c) => c.id === id);

  if (index === -1) {
    return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
  }

  mockStore.categories[index] = { ...mockStore.categories[index], ...body };
  return NextResponse.json({ success: true, data: mockStore.categories[index] });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = mockStore.categories.findIndex((c) => c.id === id);

  if (index === -1) {
    return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
  }

  mockStore.categories.splice(index, 1);
  return NextResponse.json({ success: true });
}
