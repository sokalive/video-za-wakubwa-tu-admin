import bcrypt from "bcryptjs";
import { normalizeGoogleDriveUrl, isValidGoogleDriveUrl } from "@/lib/google-drive";
import { deleteR2Object } from "@/lib/r2-client";
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
  mapVideoReport,
  mapVideoLikeStat,
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
  VideoReport,
  VideoLikeStat,
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

export async function listVideoReports(): Promise<VideoReport[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("video_reports")
    .select("*, videos(title)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapVideoReport);
}

export async function dismissVideoReport(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("video_reports")
    .update({ status: "dismissed" })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteVideoReport(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("video_reports")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function listVideoLikeStats(limit = 50): Promise<VideoLikeStat[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("videos")
    .select("id, title, likes_count, views, category_name")
    .order("likes_count", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapVideoLikeStat);
}

// ─── Videos ─────────────────────────────────────────────────

async function syncCategoryVideoCount(db: ReturnType<typeof getSupabaseAdmin>, categoryId: string): Promise<void> {
  if (!categoryId) return;
  const { count } = await db
    .from("videos")
    .select("*", { count: "exact", head: true })
    .eq("category_id", categoryId);
  await db.from("categories").update({ video_count: count ?? 0 }).eq("id", categoryId);
}

async function syncCategoryVideoCounts(db: ReturnType<typeof getSupabaseAdmin>, categoryIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(categoryIds.filter(Boolean))];
  await Promise.all(uniqueIds.map((categoryId) => syncCategoryVideoCount(db, categoryId)));
}

export async function listVideos(filters?: { search?: string; category?: string; isVip?: boolean }): Promise<Video[]> {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "created_at.desc");
  if (filters?.category) params.set("category_id", `eq.${filters.category}`);
  if (filters?.isVip !== undefined) params.set("is_vip", `eq.${filters.isVip}`);

  const { data, error } = await supabaseRest<Record<string, unknown>[]>(`videos?${params.toString()}`);
  if (error) throw new Error(`Failed to load videos: ${error}`);

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

  const videoUrl = (body.videoUrl ?? "").trim();
  const r2ObjectKey = (body.r2ObjectKey ?? "").trim();
  const driveInput = (body.googleDriveUrl ?? "").trim();

  if (!videoUrl && !driveInput) {
    throw new Error("Upload a video file to R2 or provide a legacy Google Drive link.");
  }

  let storedVideoUrl = "";
  let storedDriveUrl = "";
  let videoStorage: "r2" | "google_drive" = "google_drive";
  let storedR2Key = "";

  if (videoUrl) {
    storedVideoUrl = videoUrl;
    storedR2Key = r2ObjectKey;
    videoStorage = "r2";
  } else if (isValidGoogleDriveUrl(driveInput)) {
    storedDriveUrl = normalizeGoogleDriveUrl(driveInput)!;
    videoStorage = "google_drive";
  } else {
    throw new Error("Invalid video source. Upload a file to R2.");
  }

  const id = `vid-${Date.now()}`;
  const row = {
    id,
    title: body.title,
    description: body.description ?? "",
    category_id: body.categoryId,
    category_name: categoryName,
    thumbnail_url: body.thumbnailUrl ?? "",
    video_url: storedVideoUrl,
    r2_object_key: storedR2Key,
    video_storage: videoStorage,
    google_drive_url: storedDriveUrl,
    duration: body.duration ?? "0:00",
    resolution: body.resolution ?? "1080p",
    is_vip: body.isVip ?? false,
    is_featured: body.isFeatured ?? false,
    autoplay: body.autoplay ?? false,
    tags: body.tags ?? [],
    views: 0,
    likes_count: 0,
    published: true,
  };
  const { data, error } = await supabaseRest<Record<string, unknown>[]>("videos", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (error) throw new Error(error);
  const created = data?.[0];
  if (!created) throw new Error("Failed to create video record.");

  if (body.categoryId) await syncCategoryVideoCount(db, body.categoryId);
  await logActivity(adminId, adminName, "upload", "video", `Uploaded video: ${body.title}`, id);
  return mapVideo(created);
}

export async function updateVideo(
  id: string,
  body: Partial<Video>,
  adminId?: string,
  adminName?: string
): Promise<Video> {
  const db = getSupabaseAdmin();
  const { data: existingRows, error: existingError } = await supabaseRest<Record<string, unknown>[]>(
    `videos?select=category_id,r2_object_key,video_storage&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  if (existingError) throw new Error(existingError);
  const existing = existingRows?.[0];

  const updates = mapVideoToDb(body);

  if (body.videoUrl !== undefined) {
    updates.video_url = body.videoUrl;
    updates.video_storage = body.videoStorage ?? "r2";
  }
  if (body.r2ObjectKey !== undefined) {
    updates.r2_object_key = body.r2ObjectKey;
  }
  if (body.googleDriveUrl !== undefined) {
    if (body.googleDriveUrl && !isValidGoogleDriveUrl(body.googleDriveUrl)) {
      throw new Error("Invalid Google Drive link");
    }
    updates.google_drive_url = body.googleDriveUrl
      ? normalizeGoogleDriveUrl(body.googleDriveUrl)
      : "";
  }
  if (body.categoryId) {
    const { data: cat } = await db.from("categories").select("name").eq("id", body.categoryId).single();
    if (cat) updates.category_name = cat.name;
  }

  const previousR2Key = (existing?.r2_object_key as string) ?? "";
  const nextR2Key = body.r2ObjectKey ?? previousR2Key;

  const { data: updatedRows, error } = await supabaseRest<Record<string, unknown>[]>(
    `videos?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(updates),
    }
  );
  if (error) throw new Error(error);
  const updated = updatedRows?.[0];
  if (!updated) throw new Error("Video not found.");

  if (
    previousR2Key &&
    nextR2Key &&
    previousR2Key !== nextR2Key &&
    (existing?.video_storage === "r2" || body.videoStorage === "r2")
  ) {
    try {
      await deleteR2Object(previousR2Key);
    } catch {
      // DB record updated; orphaned object can be cleaned manually
    }
  }

  const categoryIds = [existing?.category_id as string, body.categoryId].filter(Boolean) as string[];
  await syncCategoryVideoCounts(db, categoryIds);

  if (adminId && adminName) {
    await logActivity(adminId, adminName, "update", "video", `Updated video: ${updated.title as string}`, id);
  }

  return mapVideo(updated);
}

export async function deleteVideo(id: string, adminId: string, adminName: string): Promise<void> {
  const db = getSupabaseAdmin();

  const { data: rows, error: fetchError } = await supabaseRest<Record<string, unknown>[]>(
    `videos?select=title,category_id,r2_object_key,video_storage&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  if (fetchError) throw new Error(fetchError);
  const video = rows?.[0];
  if (!video) throw new Error("Video not found.");

  const r2Key = (video.r2_object_key as string) ?? "";
  if (r2Key && video.video_storage === "r2") {
    try {
      await deleteR2Object(r2Key);
    } catch (err) {
      throw new Error(
        `Failed to delete R2 object: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  const { error } = await supabaseRest(`videos?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (error) throw new Error(error);

  if (video.category_id) await syncCategoryVideoCount(db, video.category_id as string);
  await logActivity(adminId, adminName, "delete", "video", `Deleted video: ${video.title ?? id}`, id);
}

// ─── Categories ─────────────────────────────────────────────

export async function listCategories(): Promise<Category[]> {
  const db = getSupabaseAdmin();
  const [{ data: categories }, { data: videos }] = await Promise.all([
    db.from("categories").select("*").order("name"),
    db.from("videos").select("category_id"),
  ]);

  const counts = new Map<string, number>();
  for (const video of videos ?? []) {
    const categoryId = video.category_id as string | null;
    if (!categoryId) continue;
    counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
  }

  return (categories ?? []).map((row) =>
    mapCategory({
      ...row,
      video_count: counts.get(row.id as string) ?? 0,
    })
  );
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
  const { data, error } = await supabaseRest<Record<string, unknown>[]>(
    "vip_plans?select=*&order=duration_days.asc"
  );
  if (error) throw new Error(`Failed to load VIP plans: ${error}`);
  return (data ?? []).map(mapVipPlan);
}

export async function updateVipPlan(id: string, body: Partial<VipPlan>): Promise<VipPlan> {
  const updates = mapVipPlanToDb(body);
  const { data: rows, error } = await supabaseRest<Record<string, unknown>[]>(
    `vip_plans?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(updates),
    }
  );
  if (error) throw new Error(error);
  const updated = rows?.[0];
  if (!updated) throw new Error("VIP plan not found.");
  return mapVipPlan(updated);
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

export async function getUserStats(): Promise<{ total: number; vip: number; active: number }> {
  const db = getSupabaseAdmin();
  const [totalRes, vipRes, activeRes] = await Promise.all([
    db.from("users").select("id", { count: "exact", head: true }),
    db.from("users").select("id", { count: "exact", head: true }).eq("is_vip", true),
    db.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  return {
    total: totalRes.count ?? 0,
    vip: vipRes.count ?? 0,
    active: activeRes.count ?? 0,
  };
}

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
