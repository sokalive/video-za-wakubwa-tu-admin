/**
 * Seed VIP plans and mark a test video as VIP on production (or any admin URL).
 *
 * Usage:
 *   ADMIN_URL=https://video-za-wakubwa-tu-admin.vercel.app \
 *   ADMIN_EMAIL=waziriissa37@gmail.com \
 *   ADMIN_PASSWORD=... \
 *   node scripts/production-vip-setup.mjs [videoId]
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const adminUrl = (process.env.ADMIN_URL || "https://video-za-wakubwa-tu-admin.vercel.app").replace(/\/$/, "");
const email = process.env.ADMIN_EMAIL || "waziriissa37@gmail.com";
const password = process.env.ADMIN_PASSWORD;
const videoIdArg = process.argv[2];

if (!password) {
  console.error("Set ADMIN_PASSWORD (or add to .env.local)");
  process.exit(1);
}

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return "";
  const parts = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

async function login() {
  const res = await fetch(`${adminUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Login failed (${res.status})`);
  const cookie = extractCookie(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie"));
  if (!cookie) throw new Error("No session cookie returned from login");
  return cookie;
}

async function seedPlans(cookie) {
  const res = await fetch(`${adminUrl}/api/vip-plans/seed`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || "VIP plans seed failed");
  console.log("VIP plans:", data);
  return data;
}

async function listVideos(cookie) {
  const res = await fetch(`${adminUrl}/api/videos`, { headers: { Cookie: cookie } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to list videos");
  return data.data ?? [];
}

async function markVip(cookie, videoId) {
  const res = await fetch(`${adminUrl}/api/videos/${encodeURIComponent(videoId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ isVip: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to mark video VIP");
  console.log("Marked VIP:", data.data?.id, data.data?.title);
  return data.data;
}

async function verifyWebsitePlans() {
  const res = await fetch("https://video-za-wakubwa-tu.vercel.app/api/vip-plans");
  const data = await res.json();
  console.log("Website vip-plans:", data);
  return data.data ?? [];
}

async function verifyWebsiteVideo(videoId) {
  const res = await fetch(`https://video-za-wakubwa-tu.vercel.app/api/videos?limit=50`);
  const data = await res.json();
  const video = (data.data ?? []).find((v) => v.id === videoId);
  console.log("Website video isVip:", video?.id, video?.isVip);
  return video;
}

async function main() {
  console.log("Admin URL:", adminUrl);
  const cookie = await login();
  console.log("Logged in.");

  await seedPlans(cookie);

  let videoId = videoIdArg;
  if (!videoId) {
    const videos = await listVideos(cookie);
    videoId = videos[0]?.id;
  }
  if (!videoId) throw new Error("No video found to mark as VIP");

  await markVip(cookie, videoId);

  const plans = await verifyWebsitePlans();
  const video = await verifyWebsiteVideo(videoId);

  console.log("\n--- Summary ---");
  console.log("Plans count:", plans.length);
  console.log("Test video:", videoId, "isVip:", video?.isVip);
  console.log("Watch URL:", `https://video-za-wakubwa-tu.vercel.app/video/${videoId}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
