import { NextResponse } from "next/server";
import { mockStore } from "@/lib/mock-data";
import type { Advertisement } from "@/types";

export async function GET() {
  return NextResponse.json({ success: true, data: mockStore.ads });
}

export async function POST(request: Request) {
  const body = await request.json();
  const newAd: Advertisement = {
    id: `ad-${Date.now()}`,
    title: body.title,
    type: body.type,
    placement: body.placement,
    imageUrl: body.imageUrl || "https://picsum.photos/seed/ad/728/90",
    linkUrl: body.linkUrl,
    isEnabled: body.isEnabled ?? true,
    impressions: 0,
    clicks: 0,
    createdAt: new Date().toISOString(),
  };

  mockStore.ads.push(newAd);
  return NextResponse.json({ success: true, data: newAd }, { status: 201 });
}
