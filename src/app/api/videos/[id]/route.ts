import { NextResponse } from "next/server";
import { mockStore } from "@/lib/mock-data";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const index = mockStore.videos.findIndex((v) => v.id === id);

  if (index === -1) {
    return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
  }

  const category = body.categoryId
    ? mockStore.categories.find((c) => c.id === body.categoryId)
    : null;

  mockStore.videos[index] = {
    ...mockStore.videos[index],
    ...body,
    categoryName: category?.name || mockStore.videos[index].categoryName,
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json({ success: true, data: mockStore.videos[index] });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = mockStore.videos.findIndex((v) => v.id === id);

  if (index === -1) {
    return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
  }

  const deleted = mockStore.videos.splice(index, 1)[0];
  mockStore.activityLogs.unshift({
    id: `log-${Date.now()}`,
    adminId: "admin-1",
    adminName: "Super Admin",
    action: "delete",
    entity: "video",
    entityId: id,
    details: `Deleted video: ${deleted.title}`,
    ipAddress: "127.0.0.1",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
