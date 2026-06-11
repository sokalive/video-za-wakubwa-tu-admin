import { NextResponse } from "next/server";
import { mockStore } from "@/lib/mock-data";
import type { Video } from "@/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.toLowerCase();
  const category = searchParams.get("category");
  const isVip = searchParams.get("isVip");

  let videos = [...mockStore.videos];

  if (search) {
    videos = videos.filter(
      (v) =>
        v.title.toLowerCase().includes(search) ||
        v.description.toLowerCase().includes(search) ||
        v.tags.some((t) => t.toLowerCase().includes(search))
    );
  }

  if (category) {
    videos = videos.filter((v) => v.categoryId === category);
  }

  if (isVip !== null && isVip !== undefined && isVip !== "") {
    videos = videos.filter((v) => v.isVip === (isVip === "true"));
  }

  return NextResponse.json({ success: true, data: videos });
}

export async function POST(request: Request) {
  const body = await request.json();
  const category = mockStore.categories.find((c) => c.id === body.categoryId);

  const newVideo: Video = {
    id: `vid-${Date.now()}`,
    title: body.title,
    description: body.description || "",
    categoryId: body.categoryId,
    categoryName: category?.name || "Unknown",
    thumbnailUrl: body.thumbnailUrl || "https://picsum.photos/seed/new/640/360",
    videoUrl: body.videoUrl || "/videos/new.mp4",
    trailerUrl: body.trailerUrl,
    duration: body.duration || "0:00:00",
    resolution: body.resolution || "1080p",
    isVip: body.isVip ?? false,
    isFeatured: body.isFeatured ?? false,
    tags: body.tags || [],
    views: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockStore.videos.unshift(newVideo);
  mockStore.activityLogs.unshift({
    id: `log-${Date.now()}`,
    adminId: "admin-1",
    adminName: "Super Admin",
    action: "upload",
    entity: "video",
    entityId: newVideo.id,
    details: `Uploaded video: ${newVideo.title}`,
    ipAddress: "127.0.0.1",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, data: newVideo }, { status: 201 });
}
