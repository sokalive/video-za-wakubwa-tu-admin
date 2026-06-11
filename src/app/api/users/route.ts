import { NextResponse } from "next/server";
import { mockStore } from "@/lib/mock-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.toLowerCase();
  const isVip = searchParams.get("isVip");
  const isActive = searchParams.get("isActive");

  let users = [...mockStore.users];

  if (search) {
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
    );
  }

  if (isVip !== null && isVip !== undefined && isVip !== "") {
    users = users.filter((u) => u.isVip === (isVip === "true"));
  }

  if (isActive !== null && isActive !== undefined && isActive !== "") {
    users = users.filter((u) => u.isActive === (isActive === "true"));
  }

  return NextResponse.json({ success: true, data: users });
}
