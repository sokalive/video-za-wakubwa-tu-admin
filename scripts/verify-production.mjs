/**
 * Production verification script
 * Usage: node scripts/verify-production.mjs
 *
 * Requires env vars (same as seed):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY (optional, tests website read path)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const ADMIN_URL = process.env.ADMIN_URL || "https://video-za-wakubwa-tu-admin.vercel.app";
const WEBSITE_URL = process.env.WEBSITE_URL || "https://video-za-wakubwa-tu.vercel.app";

const results = [];

function pass(label) {
  results.push({ label, status: "PASS" });
  console.log(`  ✓ ${label}`);
}

function fail(label, reason) {
  results.push({ label, status: "FAIL", reason });
  console.log(`  ✗ ${label}: ${reason}`);
}

function warn(label, reason) {
  results.push({ label, status: "WARN", reason });
  console.log(`  ⚠ ${label}: ${reason}`);
}

async function main() {
  console.log("\n=== Video Za Wakubwa Tu — Production Verification ===\n");

  // 1. Environment variables
  console.log("1. Environment Variables");
  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL", "not set");
  else pass("NEXT_PUBLIC_SUPABASE_URL");

  if (!serviceKey) fail("SUPABASE_SERVICE_ROLE_KEY", "not set");
  else pass("SUPABASE_SERVICE_ROLE_KEY");

  if (!anonKey) warn("NEXT_PUBLIC_SUPABASE_ANON_KEY", "not set (website reads untested locally)");
  else pass("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!process.env.JWT_SECRET) warn("JWT_SECRET", "not set — using default (not safe for production)");
  else pass("JWT_SECRET");

  console.log("\n1b. Google Drive Upload");
  const driveJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  const driveB64 = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64;
  const driveFolder = process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_URL;
  if (!driveJson && !driveB64 && !(process.env.GOOGLE_DRIVE_CLIENT_EMAIL && process.env.GOOGLE_DRIVE_PRIVATE_KEY)) {
    warn("GOOGLE_DRIVE credentials", "not set — video file upload disabled (paste links only)");
  } else pass("GOOGLE_DRIVE credentials env present");
  if (!driveFolder) fail("GOOGLE_DRIVE_FOLDER_ID", "not set — required for uploads (add folder ID from Drive URL)");
  else pass(`GOOGLE_DRIVE_FOLDER_ID (${driveFolder.slice(0, 12)}...)`);
  if (driveJson) {
    try {
      JSON.parse(driveJson.trim().replace(/^["']|["']$/g, ""));
      pass("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON parses as JSON");
    } catch {
      warn("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON", "invalid JSON — use minified single line or BASE64 variant");
    }
  }

  if (!url || !serviceKey) {
    console.log("\nCannot continue without Supabase credentials.\n");
    process.exit(1);
  }

  const adminDb = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 2. Database tables
  console.log("\n2. Database Tables");
  const tables = ["admins", "categories", "videos", "vip_plans", "apk_releases", "site_settings"];
  for (const table of tables) {
    const { error } = await adminDb.from(table).select("*").limit(1);
    if (error) fail(`Table: ${table}`, error.message);
    else pass(`Table: ${table}`);
  }

  // 3. Admin account
  console.log("\n3. Admin Account");
  const { data: admins, error: adminErr } = await adminDb.from("admins").select("email, role");
  if (adminErr) fail("Admin query", adminErr.message);
  else if (!admins?.length) fail("Admin account", "no admins found — run npm run seed");
  else pass(`Admin account (${admins.length} admin(s): ${admins.map((a) => a.email).join(", ")})`);

  // 4. Categories
  console.log("\n4. Categories");
  const { data: cats } = await adminDb.from("categories").select("id, name");
  if (!cats?.length) warn("Categories", "empty — run npm run seed or add via admin");
  else pass(`Categories (${cats.length} found)`);

  // 5. Videos with Google Drive links
  console.log("\n5. Videos (Google Drive)");
  const { data: videos } = await adminDb.from("videos").select("id, title, google_drive_url, thumbnail_url, is_vip, published");
  if (!videos?.length) warn("Videos", "empty — add via admin or run npm run seed:test-video");
  else {
    pass(`Videos (${videos.length} found)`);
    const withDrive = videos.filter((v) => v.google_drive_url);
    if (withDrive.length) pass(`Videos with Google Drive link (${withDrive.length})`);
    else warn("Google Drive links", "no videos have google_drive_url set");
    const published = videos.filter((v) => v.published);
    pass(`Published videos (${published.length})`);
  }

  // 6. Storage bucket
  console.log("\n6. Storage Bucket");
  const { data: buckets, error: bucketErr } = await adminDb.storage.listBuckets();
  if (bucketErr) fail("Storage buckets", bucketErr.message);
  else {
    const media = buckets?.find((b) => b.name === "media");
    if (!media) fail("media bucket", "not found — run supabase/storage.sql");
    else if (!media.public) warn("media bucket", "exists but not public");
    else pass("media bucket (public)");
  }

  // 7. Website read path (anon key)
  console.log("\n7. Website Read Path (anon key)");
  if (anonKey) {
    const publicDb = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: pubVideos, error: pubErr } = await publicDb.from("videos").select("id, title").eq("published", true).limit(5);
    if (pubErr) fail("Anon read videos", pubErr.message);
    else if (!pubVideos?.length) warn("Anon read videos", "0 published videos visible to website");
    else pass(`Anon read videos (${pubVideos.length} visible)`);
  }

  // 8. Live website API
  console.log("\n8. Live Website API");
  try {
    const res = await fetch(`${WEBSITE_URL}/api/videos?limit=3`);
    const json = await res.json();
    if (!res.ok) fail("Website /api/videos", `HTTP ${res.status}`);
    else if (!json.data?.length) warn("Website /api/videos", "returns empty — Supabase env vars may be missing on Vercel");
    else pass(`Website /api/videos (${json.data.length} videos, ${json.totalItems} total)`);
  } catch (e) {
    fail("Website /api/videos", e.message);
  }

  // 9. Admin login page
  console.log("\n9. Admin Panel");
  try {
    const res = await fetch(`${ADMIN_URL}/login`);
    if (res.ok) pass("Admin login page reachable");
    else fail("Admin login page", `HTTP ${res.status}`);
  } catch (e) {
    fail("Admin login page", e.message);
  }

  // Summary
  console.log("\n=== Summary ===");
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const warnings = results.filter((r) => r.status === "WARN").length;
  console.log(`  PASS: ${passed}  FAIL: ${failed}  WARN: ${warnings}`);

  if (failed > 0) {
    console.log("\n  Production NOT ready — fix FAIL items above.\n");
    process.exit(1);
  }
  if (warnings > 0) {
    console.log("\n  Production partially ready — review WARN items.\n");
  } else {
    console.log("\n  Production READY.\n");
  }
}

main().catch(console.error);
