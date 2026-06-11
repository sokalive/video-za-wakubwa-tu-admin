import { NextResponse } from "next/server";
import { mockStore } from "@/lib/mock-data";
import type { Category } from "@/types";

export async function GET() {
  return NextResponse.json({ success: true, data: mockStore.categories });
}

export async function POST(request: Request) {
  const body = await request.json();
  const newCategory: Category = {
    id: `cat-${Date.now()}`,
    name: body.name,
    slug: body.slug || body.name.toLowerCase().replace(/\s+/g, "-"),
    description: body.description || "",
    videoCount: 0,
    thumbnailUrl: body.thumbnailUrl,
    createdAt: new Date().toISOString(),
  };

  mockStore.categories.push(newCategory);
  return NextResponse.json({ success: true, data: newCategory }, { status: 201 });
}
