import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { uploadFile } from "@/lib/db/repository";
import { isDbConfigured } from "@/lib/db/client";

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "thumbnails";

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const validFolders = ["thumbnails", "videos", "apk", "screenshots"];
    if (!validFolders.includes(folder)) {
      return NextResponse.json({ success: false, error: "Invalid folder" }, { status: 400 });
    }

    const url = await uploadFile(file, folder as "thumbnails" | "videos" | "apk" | "screenshots");
    return NextResponse.json({ success: true, url });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
