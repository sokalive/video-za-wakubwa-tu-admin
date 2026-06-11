/**
 * Seed a test video with Google Drive link for sync verification.
 * Usage: node scripts/seed-test-video.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

// Public sample — replace with your own Drive link in production
const TEST_DRIVE_URL = process.env.TEST_GOOGLE_DRIVE_URL ||
  "https://drive.google.com/file/d/1jWhhOrEAE7vW0HEqNGDqYjB5N8UvR6XH/view";

async function seedTestVideo() {
  const testVideo = {
    id: "vid-test-gdrive",
    title: "Test Video - Google Drive Sync",
    description: "Test video to verify admin-to-website synchronization via Google Drive.",
    category_id: "cat-1",
    category_name: "Mpya",
    thumbnail_url: "https://picsum.photos/seed/vzw-test/480/270",
    google_drive_url: TEST_DRIVE_URL,
    duration: "5:30",
    resolution: "1080p",
    is_vip: false,
    is_featured: true,
    tags: ["test", "google-drive"],
    views: 0,
    published: true,
  };

  const { error } = await db.from("videos").upsert(testVideo, { onConflict: "id" });
  if (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }
  console.log("Test video seeded:", testVideo.id);
  console.log("Title:", testVideo.title);
  console.log("Drive URL:", testVideo.google_drive_url);
  console.log("Verify at: https://video-za-wakubwa-tu.vercel.app/video/vid-test-gdrive");
}

seedTestVideo();
