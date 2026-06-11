import { NextResponse } from "next/server";
import { mockStore } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ success: true, data: mockStore.settings });
}

export async function PUT(request: Request) {
  const body = await request.json();
  mockStore.settings = { ...mockStore.settings, ...body };
  return NextResponse.json({ success: true, data: mockStore.settings });
}
