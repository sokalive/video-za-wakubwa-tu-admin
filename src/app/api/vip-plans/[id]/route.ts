import { NextResponse } from "next/server";
import { mockStore } from "@/lib/mock-data";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const index = mockStore.vipPlans.findIndex((p) => p.id === id);

  if (index === -1) {
    return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
  }

  mockStore.vipPlans[index] = { ...mockStore.vipPlans[index], ...body };
  return NextResponse.json({ success: true, data: mockStore.vipPlans[index] });
}
