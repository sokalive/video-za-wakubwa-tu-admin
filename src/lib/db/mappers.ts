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
  DashboardStats,
  AnalyticsData,
} from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapVideo(row: Record<string, any>): Video {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    categoryId: row.category_id ?? "",
    categoryName: row.category_name ?? "",
    thumbnailUrl: row.thumbnail_url ?? "",
    googleDriveUrl: row.google_drive_url ?? row.video_url ?? "",
    duration: row.duration ?? "0:00",
    resolution: row.resolution ?? "1080p",
    isVip: row.is_vip ?? false,
    isFeatured: row.is_featured ?? false,
    tags: row.tags ?? [],
    views: row.views ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapVideoToDb(video: Partial<Video>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (video.title !== undefined) data.title = video.title;
  if (video.description !== undefined) data.description = video.description;
  if (video.categoryId !== undefined) data.category_id = video.categoryId;
  if (video.categoryName !== undefined) data.category_name = video.categoryName;
  if (video.thumbnailUrl !== undefined) data.thumbnail_url = video.thumbnailUrl;
  if (video.googleDriveUrl !== undefined) data.google_drive_url = video.googleDriveUrl;
  if (video.duration !== undefined) data.duration = video.duration;
  if (video.resolution !== undefined) data.resolution = video.resolution;
  if (video.isVip !== undefined) data.is_vip = video.isVip;
  if (video.isFeatured !== undefined) data.is_featured = video.isFeatured;
  if (video.tags !== undefined) data.tags = video.tags;
  if (video.views !== undefined) data.views = video.views;
  data.updated_at = new Date().toISOString();
  return data;
}

export function mapCategory(row: Record<string, any>): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    videoCount: row.video_count ?? 0,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapCategoryToDb(cat: Partial<Category>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (cat.name !== undefined) data.name = cat.name;
  if (cat.slug !== undefined) data.slug = cat.slug;
  if (cat.description !== undefined) data.description = cat.description;
  if (cat.thumbnailUrl !== undefined) data.thumbnail_url = cat.thumbnailUrl;
  return data;
}

export function mapVipPlan(row: Record<string, any>): VipPlan {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    price: row.price,
    durationDays: row.duration_days,
    features: row.features ?? [],
    isActive: row.is_active ?? true,
  };
}

export function mapVipPlanToDb(plan: Partial<VipPlan>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (plan.name !== undefined) data.name = plan.name;
  if (plan.price !== undefined) data.price = plan.price;
  if (plan.durationDays !== undefined) data.duration_days = plan.durationDays;
  if (plan.features !== undefined) data.features = plan.features;
  if (plan.isActive !== undefined) data.is_active = plan.isActive;
  return data;
}

export function mapApk(row: Record<string, any>): ApkRelease {
  return {
    id: row.id,
    version: row.version,
    fileUrl: row.file_url ?? "",
    fileSize: row.file_size ?? "",
    releaseNotes: row.release_notes ?? "",
    screenshots: row.screenshots ?? [],
    forceUpdate: row.force_update ?? false,
    downloadCount: row.download_count ?? 0,
    createdAt: row.created_at,
  };
}

export function mapUser(row: Record<string, any>): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    isVip: row.is_vip ?? false,
    vipExpiresAt: row.vip_expires_at ?? undefined,
    isActive: row.is_active ?? true,
    totalSpent: row.total_spent ?? 0,
    joinedAt: row.joined_at,
    lastActive: row.last_active,
  };
}

export function mapPayment(row: Record<string, any>): Payment {
  return {
    id: row.id,
    userId: row.user_id ?? "",
    userName: row.user_name,
    planId: row.plan_id ?? "",
    planName: row.plan_name,
    amount: row.amount,
    status: row.status,
    method: row.method ?? "",
    createdAt: row.created_at,
  };
}

export function mapAd(row: Record<string, any>): Advertisement {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    placement: row.placement,
    imageUrl: row.image_url ?? "",
    linkUrl: row.link_url ?? undefined,
    isEnabled: row.is_enabled ?? true,
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    createdAt: row.created_at,
  };
}

export function mapAdmin(row: Record<string, any>): Admin {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    lastLogin: row.last_login ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapActivityLog(row: Record<string, any>): ActivityLog {
  return {
    id: row.id,
    adminId: row.admin_id ?? "",
    adminName: row.admin_name,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id ?? undefined,
    details: row.details ?? "",
    ipAddress: row.ip_address ?? "",
    createdAt: row.created_at,
  };
}

export function mapSettings(row: Record<string, any>): SiteSettings {
  return {
    websiteName: row.website_name,
    logoUrl: row.logo_url ?? "",
    homepageBannerUrl: row.homepage_banner_url ?? "",
    footerText: row.footer_text ?? "",
    contactEmail: row.contact_email ?? "",
    contactPhone: row.contact_phone ?? "",
    socialLinks: row.social_links ?? [],
  };
}

export function mapSettingsToDb(s: Partial<SiteSettings>): Record<string, unknown> {
  const data: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (s.websiteName !== undefined) data.website_name = s.websiteName;
  if (s.logoUrl !== undefined) data.logo_url = s.logoUrl;
  if (s.homepageBannerUrl !== undefined) data.homepage_banner_url = s.homepageBannerUrl;
  if (s.footerText !== undefined) data.footer_text = s.footerText;
  if (s.contactEmail !== undefined) data.contact_email = s.contactEmail;
  if (s.contactPhone !== undefined) data.contact_phone = s.contactPhone;
  if (s.socialLinks !== undefined) data.social_links = s.socialLinks;
  return data;
}

export async function computeDashboardStats(db: ReturnType<typeof import("./client").getSupabaseAdmin>): Promise<DashboardStats> {
  const [videos, users, categories] = await Promise.all([
    db.from("videos").select("is_vip, views"),
    db.from("users").select("id"),
    db.from("categories").select("id"),
  ]);

  const vids = videos.data ?? [];

  return {
    totalVideos: vids.length,
    totalVipVideos: vids.filter((v) => v.is_vip).length,
    totalFreeVideos: vids.filter((v) => !v.is_vip).length,
    totalCategories: categories.data?.length ?? 0,
    totalUsers: users.data?.length ?? 0,
    totalViews: vids.reduce((s, v) => s + (v.views ?? 0), 0),
  };
}

export async function computeAnalytics(db: ReturnType<typeof import("./client").getSupabaseAdmin>): Promise<AnalyticsData> {
  const { data: videos } = await db.from("videos").select("*").order("views", { ascending: false }).limit(5);
  const { data: categories } = await db.from("categories").select("*").limit(5);

  const dailyViews = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split("T")[0],
    views: Math.floor(Math.random() * 50000) + 30000,
  }));

  const monthlyViews = [
    { month: "Jan", views: 820000 }, { month: "Feb", views: 910000 },
    { month: "Mar", views: 1050000 }, { month: "Apr", views: 980000 },
    { month: "May", views: 1120000 }, { month: "Jun", views: 890000 },
  ];

  return {
    dailyViews,
    weeklyViews: Array.from({ length: 12 }, (_, i) => ({
      week: `Week ${i + 1}`,
      views: Math.floor(Math.random() * 200000) + 150000,
    })),
    monthlyViews,
    revenueChart: dailyViews.map((d) => ({
      date: d.date,
      revenue: Math.floor(Math.random() * 2000000) + 500000,
    })),
    topVideos: (videos ?? []).map((v) => ({
      id: v.id,
      title: v.title,
      views: v.views ?? 0,
      revenue: Math.floor((v.views ?? 0) * 0.05),
    })),
    topCategories: (categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      views: Math.floor(Math.random() * 500000) + 100000,
      videoCount: c.video_count ?? 0,
    })),
  };
}
