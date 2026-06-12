/**
 * Database seed script
 * Usage: node scripts/seed.mjs
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "waziriissa37@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Isamu2025";
const ADMIN_NAME = process.env.ADMIN_NAME || "Waziri Admin";

async function seed() {
  console.log("Seeding database...");

  // Create admin
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const { error: adminError } = await db.from("admins").upsert(
    { email: ADMIN_EMAIL.toLowerCase(), name: ADMIN_NAME, password_hash: passwordHash, role: "super_admin" },
    { onConflict: "email" }
  );
  if (adminError) console.error("Admin seed error:", adminError.message);
  else console.log("Admin created:", ADMIN_EMAIL);

  // Seed categories
  const categories = [
    { id: "cat-1", name: "Mpya", slug: "mpya", icon: "sparkles", videoCount: 48 },
    { id: "cat-2", name: "Maarufu", slug: "maarufu", icon: "fire", videoCount: 120 },
    { id: "cat-3", name: "HD", slug: "hd", icon: "hd", videoCount: 86 },
    { id: "cat-4", name: "VIP", slug: "vip", icon: "crown", videoCount: 64 },
    { id: "cat-5", name: "Bure", slug: "bure", icon: "free", videoCount: 32 },
    { id: "cat-6", name: "Tamu", slug: "tamu", icon: "heart", videoCount: 55 },
    { id: "cat-7", name: "Kali", slug: "kali", icon: "hot", videoCount: 41 },
    { id: "cat-8", name: "Zote", slug: "zote", icon: "grid", videoCount: 320 },
  ];
  for (const cat of categories) {
    await db.from("categories").upsert({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      video_count: cat.videoCount,
    }, { onConflict: "id" });
  }
  console.log(`Seeded ${categories.length} categories`);

  // Seed VIP plans
  const plans = [
    { id: "plan-daily", name: "1 Day", type: "daily", price: 2000, duration_days: 1, duration_label: "1 Day", currency: "TZS", is_active: true, features: ["Access all VIP videos", "HD quality", "No ads"] },
    { id: "plan-weekly", name: "1 Week", type: "weekly", price: 8000, duration_days: 7, duration_label: "1 Week", currency: "TZS", is_active: true, popular: true, features: ["Access all VIP videos", "Full HD quality", "No ads", "Priority support"] },
    { id: "plan-monthly", name: "1 Month", type: "monthly", price: 20000, duration_days: 30, duration_label: "1 Month", currency: "TZS", is_active: true, features: ["Access all VIP videos", "Best quality", "No ads", "Unlimited downloads", "VIP badge"] },
  ];
  for (const plan of plans) {
    await db.from("vip_plans").upsert(plan, { onConflict: "id" });
  }
  console.log("Seeded VIP plans");

  // Seed videos from public website data
  const categoryNames = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const channels = ["Kali_HD", "VIP_Channel", "Mpya_Video", "Wakubwa_TV", "Ndefu_Clips", "Bure_Stream", "Tamu_Official"];
  const titles = [
    "Tamu Sana Usiku Huu", "Moto Wa Mapenzi", "Kali Na Tamu", "Usiku Mrefu",
    "Mapenzi Ya Kweli", "Mchana Wa Joto", "Tamu Kwa Muda", "Moto Usiozima",
    "Penzi La Siri", "Joto La Asubuhi", "Tamu Kila Dakika", "Moto Wa Moyo",
  ];
  const categoryIds = ["cat-1", "cat-2", "cat-3", "cat-4", "cat-5", "cat-6", "cat-7"];

  for (let i = 0; i < 36; i++) {
    const id = `vid-${String(i + 1).padStart(3, "0")}`;
    const catId = categoryIds[i % categoryIds.length];
    await db.from("videos").upsert({
      id,
      title: `${titles[i % titles.length]} ${i + 1}`,
      description: `Angalia video hii ya kipekee — ${titles[i % titles.length].toLowerCase()}. Maudhui ya hali ya juu.`,
      category_id: catId,
      category_name: categoryNames[catId],
      thumbnail_url: `https://picsum.photos/seed/vzw${i + 1}/480/270`,
      duration: `${String(Math.floor(Math.random() * 50) + 10).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
      resolution: ["720p", "1080p", "4K"][i % 3],
      is_vip: catId === "cat-4",
      is_featured: i < 12,
      views: 2000 + i * 1000,
      rating: 70 + (i % 20),
      channel: channels[i % channels.length],
      tags: ["kali", "vip", "hd", "mpya", "maarufu", "bure", "tamu"][i % 7] ? [["kali", "vip", "hd", "mpya", "maarufu", "bure", "tamu"][i % 7]] : [],
      published: true,
    }, { onConflict: "id" });
  }
  console.log("Seeded 36 videos");

  // Seed APK
  await db.from("apk_releases").upsert({
    id: "current",
    version: "2.4.1",
    file_url: "",
    file_size: "45 MB",
    release_notes: "- Fixed streaming buffer issues\n- Added dark mode\n- Performance improvements",
    screenshots: [],
    force_update: false,
    download_count: 0,
  }, { onConflict: "id" });
  console.log("Seeded APK release");

  // Seed site settings
  await db.from("site_settings").upsert({
    id: "main",
    website_name: "Video Za Wakubwa Tu",
    footer_text: "© 2026 Video Za Wakubwa Tu. All rights reserved.",
    contact_email: "support@vzwakubwa.com",
    contact_phone: "+255 700 000 000",
    social_links: [],
  }, { onConflict: "id" });
  console.log("Seeded site settings");

  console.log("Seed complete!");
}

seed().catch(console.error);
