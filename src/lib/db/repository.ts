import bcrypt from "bcryptjs";
import { normalizeGoogleDriveUrl, isValidGoogleDriveUrl } from "@/lib/google-drive";
import { getSupabaseAdmin, STORAGE_BUCKET } from "./client";
import { supabaseRest } from "./rest";
import {
  mapAdmin,
  mapVideo,
  mapVideoToDb,
  mapCategory,
  mapCategoryToDb,
  mapVipPlan,
  mapVipPlanToDb,
  mapApk,
  mapUser,
  mapPayment,
  mapAd,
  mapActivityLog,
  mapSettings,
  mapSettingsToDb,
  computeDashboardStats,
  computeAnalytics,
} from "./mappers";
import type {
  Admin,
  Video,
  Category,
  VipPlan,
  ApkRelease,
  User,
  Payment,
  Advertisement,
  ActivityLog,
  SiteSettings,
} from "@/types";

// ─── Auth ───────────────────────────────────────────────────

export async function findAdminByEmail(email: string): Promise<(Admin & { passwordHash: string }) | null> {
  const { data, error } = await supabaseRest<Record<string, unknown>[]>(
    `admins?select=*&email=eq.${encodeURIComponent(email.toLowerCase())}&limit=1`
  );
  const row = data?.[0];
  if (error || !row) return null;
  return { ...mapAdmin(row), passwordHash: row.password_hash as string };
}

export async function verifyAdminPassword(email: string, password: string): Promise<Admin | null> {
  const admin = await findAdminByEmail(email);
  if (!admin) return null;
  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return null;
  await supabaseRest(`admins?id=eq.${admin.id}`, {
    method: "PATCH",
    body: JSON.stringify({ last_login: new Date().toISOString() }),
  });
  return { id: admin.id, name: admin.name, email: admin.email, role: admin.role, createdAt: admin.createdAt };
}

export async function listAdmins(): Promise<Admin[]> {
  const { data } = await getSupabaseAdmin().from("admins").select("*").order("created_at");
  return (data ?? []).map(mapAdmin);
}

// ─── Activity Logs ──────────────────────────────────────────

export async function logActivity(
  adminId: string,
  adminName: string,
  action: string,
  entity: string,
  details: string,
  entityId?: string,
  ipAddress = "127.0.0.1"
): Promise<void> {
  await getSupabaseAdmin().from("activity_logs").insert({
    admin_id: adminId,
    admin_name: adminName,
    action,
    entity,
    entity_id: entityId,
    details,
    ip_address: ipAddress,
  });
}

export async function listActivityLogs(): Promise<ActivityLog[]> {
  const { data } = await getSupabaseAdmin().from("activity_logs").select("*").order("created_at", { ascending: false }).limit(100);
  return (data ?? []).map(mapActivityLog);
}

// ─── Videos ─────────────────────────────────────────────────

export async function listVideos(filters?: { search?: string; category?: string; isVip?: boolean }): Promise<Video[]> {
  let query = getSupabaseAdmin().from("videos").select("*").order("created_at", { ascending: false });
  if (filters?.category) query = query.eq("category_id", filters.category);
  if (filters?.isVip !== undefined) query = query.eq("is_vip", filters.isVip);
  const { data } = await query;
  let videos = (data ?? []).map(mapVideo);
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    videos = videos.filter(
      (v) =>
        v.title.toLowerCase().includes(s) ||
        v.description.toLowerCase().includes(s) ||
        v.tags.some((t) => t.toLowerCase().includes(s))
    );
  }
  return videos;
}

export async function createVideo(body: Partial<Video>, adminId: string, adminName: string): Promise<Video> {
  const db = getSupabaseAdmin();
  let categoryName = body.categoryName ?? "";
  if (body.categoryId) {
    const { data: cat } = await db.from("categories").select("name").eq("id", body.categoryId).single();
    categoryName = cat?.name ?? categoryName;
  }

  const driveInput = body.googleDriveUrl ?? "";
  if (!isValidGoogleDriveUrl(driveInput)) {
    throw new Error("Invalid Google Drive link. Use a share link like https://drive.google.com/file/d/FILE_ID/view");
  }
  const googleDriveUrl = normalizeGoogleDriveUrl(driveInput)!;

  const id = `vid-${Date.now()}`;
  const row = {
    id,
    title: body.title,
    description: body.description ?? "",
    category_id: body.categoryId,
    category_name: categoryName,
    thumbnail_url: body.thumbnailUrl ?? "",
    google_drive_url: googleDriveUrl,
    duration: body.duration ?? "0:00",
    resolution: body.resolution ?? "1080p",
    is_vip: body.isVip ?? false,
    is_featured: body.isFeatured ?? false,
    tags: body.tags ?? [],
    views: 0,
    published: true,
  };
  const { data, error } = await db.from("videos").insert(row).select().single();
  if (error) throw new Error(error.message);
  await logActivity(adminId, adminName, "upload", "video", `Uploaded video: ${body.title}`, id);
  return mapVideo(data);
}

export async function updateVideo(id: string, body: Partial<Video>): Promise<Video> {
  const db = getSupabaseAdmin();
  const updates = mapVideoToDb(body);

  if (body.googleDriveUrl !== undefined) {
    if (!isValidGoogleDriveUrl(body.googleDriveUrl)) {
      throw new Error("Invalid Google Drive link");
    }
    updates.google_drive_url = normalizeGoogleDriveUrl(body.googleDriveUrl);
  }
  if (body.categoryId) {
    const { data: cat } = await db.from("categories").select("name").eq("id", body.categoryId).single();
    if (cat) updates.category_name = cat.name;
  }
  const { data, error } = await db.from("videos").update(updates).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return mapVideo(data);
}

export async function deleteVideo(id: string, adminId: string, adminName: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { data: video } = await db.from("videos").select("title").eq("id", id).single();
  const { error } = await db.from("videos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(adminId, adminName, "delete", "video", `Deleted video: ${video?.title ?? id}`, id);
}

// ─── Categories ─────────────────────────────────────────────

export async function listCategories(): Promise<Category[]> {
  const { data } = await getSupabaseAdmin().from("categories").select("*").order("name");
  return (data ?? []).map(mapCategory);
}

export async function createCategory(body: Partial<Category>): Promise<Category> {
  const id = `cat-${Date.now()}`;
  const row = {
    id,
    name: body.name,
    slug: body.slug || body.name!.toLowerCase().replace(/\s+/g, "-"),
    description: body.description ?? "",
    thumbnail_url: body.thumbnailUrl,
  };
  const { data, error } = await getSupabaseAdmin().from("categories").insert(row).select().single();
  if (error) throw new Error(error.message);
  return mapCategory(data);
}

export async function updateCategory(id: string, body: Partial<Category>): Promise<Category> {
  const { data, error } = await getSupabaseAdmin().from("categories").update(mapCategoryToDb(body)).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return mapCategory(data);
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── VIP Plans ──────────────────────────────────────────────

export async function listVipPlans(): Promise<VipPlan[]> {
  const { data } = await getSupabaseAdmin().from("vip_plans").select("*").order("duration_days");
  return (data ?? []).map(mapVipPlan);
}

export async function updateVipPlan(id: string, body: Partial<VipPlan>): Promise<VipPlan> {
  const { data, error } = await getSupabaseAdmin().from("vip_plans").update(mapVipPlanToDb(body)).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return mapVipPlan(data);
}

// ─── APK ────────────────────────────────────────────────────

export async function getApk(): Promise<ApkRelease | null> {
  const { data } = await getSupabaseAdmin().from("apk_releases").select("*").eq("id", "current").single();
  return data ? mapApk(data) : null;
}

export async function updateApk(body: Partial<ApkRelease>, adminId: string, adminName: string): Promise<ApkRelease> {
  const db = getSupabaseAdmin();
  const updates: Record<string, unknown> = { id: "current" };
  if (body.version) updates.version = body.version;
  if (body.fileUrl) updates.file_url = body.fileUrl;
  if (body.fileSize) updates.file_size = body.fileSize;
  if (body.releaseNotes) updates.release_notes = body.releaseNotes;
  if (body.screenshots) updates.screenshots = body.screenshots;
  if (body.forceUpdate !== undefined) updates.force_update = body.forceUpdate;
  updates.created_at = new Date().toISOString();

  const { data, error } = await db.from("apk_releases").upsert(updates).select().single();
  if (error) throw new Error(error.message);
  await logActivity(adminId, adminName, "update", "apk", `Updated APK to version ${body.version ?? data.version}`, "current");
  return mapApk(data);
}

// ─── Users / Payments / Ads / Settings ──────────────────────

export async function listUsers(filters?: { search?: string; isVip?: boolean; isActive?: boolean }): Promise<User[]> {
  let query = getSupabaseAdmin().from("users").select("*").order("joined_at", { ascending: false });
  if (filters?.isVip !== undefined) query = query.eq("is_vip", filters.isVip);
  if (filters?.isActive !== undefined) query = query.eq("is_active", filters.isActive);
  const { data } = await query;
  let users = (data ?? []).map(mapUser);
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    users = users.filter((u) => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
  }
  return users;
}

export async function listPayments(): Promise<Payment[]> {
  const { data } = await getSupabaseAdmin().from("payments").select("*").order("created_at", { ascending: false });
  return (data ?? []).map(mapPayment);
}

export async function listAds(): Promise<Advertisement[]> {
  const { data } = await getSupabaseAdmin().from("advertisements").select("*").order("created_at", { ascending: false });
  return (data ?? []).map(mapAd);
}

export async function createAd(body: Partial<Advertisement>): Promise<Advertisement> {
  const { data, error } = await getSupabaseAdmin().from("advertisements").insert({
    title: body.title,
    type: body.type,
    placement: body.placement,
    image_url: body.imageUrl ?? "",
    link_url: body.linkUrl,
    is_enabled: body.isEnabled ?? true,
  }).select().single();
  if (error) throw new Error(error.message);
  return mapAd(data);
}

export async function updateAd(id: string, body: Partial<Advertisement>): Promise<Advertisement> {
  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.isEnabled !== undefined) updates.is_enabled = body.isEnabled;
  if (body.imageUrl !== undefined) updates.image_url = body.imageUrl;
  if (body.linkUrl !== undefined) updates.link_url = body.linkUrl;
  const { data, error } = await getSupabaseAdmin().from("advertisements").update(updates).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return mapAd(data);
}

export async function deleteAd(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("advertisements").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getSettings(): Promise<SiteSettings> {
  const { data } = await getSupabaseAdmin().from("site_settings").select("*").eq("id", "main").single();
  if (!data) {
    return {
      websiteName: "Video Za Wakubwa Tu",
      logoUrl: "",
      homepageBannerUrl: "",
      footerText: "",
      contactEmail: "",
      contactPhone: "",
      socialLinks: [],
    };
  }
  return mapSettings(data);
}

export async function updateSettings(body: Partial<SiteSettings>): Promise<SiteSettings> {
  const { data, error } = await getSupabaseAdmin()
    .from("site_settings")
    .upsert({ id: "main", ...mapSettingsToDb(body) })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapSettings(data);
}

export { computeDashboardStats, computeAnalytics };

// ─── File Upload ────────────────────────────────────────────

export async function uploadFile(
  file: File,
  folder: "thumbnails" | "apk" | "screenshots"
): Promise<string> {
  const db = getSupabaseAdmin();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data: urlData } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}
