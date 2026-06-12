import {
  durationToDays,
  formatDurationLabel,
  inferPlanDurationUnit,
  type PlanDurationUnit,
} from "@/lib/duration";
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
  VideoReport,
  VideoLikeStat,
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
    videoUrl: row.video_url ?? "",
    r2ObjectKey: row.r2_object_key ?? "",
    videoStorage: row.video_storage === "r2" ? "r2" : "google_drive",
    googleDriveUrl: row.google_drive_url ?? "",
    duration: row.duration ?? "0:00",
    resolution: row.resolution ?? "1080p",
    isVip: row.is_vip ?? false,
    isFeatured: row.is_featured ?? false,
    autoplay: row.autoplay ?? false,
    tags: Array.isArray(row.tags) ? row.tags : [],
    views: row.views ?? 0,
    likesCount: row.likes_count ?? 0,
    trialEnabled: row.trial_enabled ?? false,
    trialDurationValue: row.trial_duration_value ?? 0,
    trialDurationUnit: row.trial_duration_unit ?? "minutes",
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
  if (video.videoUrl !== undefined) data.video_url = video.videoUrl;
  if (video.r2ObjectKey !== undefined) data.r2_object_key = video.r2ObjectKey;
  if (video.videoStorage !== undefined) data.video_storage = video.videoStorage;
  if (video.googleDriveUrl !== undefined) data.google_drive_url = video.googleDriveUrl;
  if (video.duration !== undefined) data.duration = video.duration;
  if (video.resolution !== undefined) data.resolution = video.resolution;
  if (video.isVip !== undefined) data.is_vip = video.isVip;
  if (video.isFeatured !== undefined) data.is_featured = video.isFeatured;
  if (video.autoplay !== undefined) data.autoplay = video.autoplay;
  if (video.tags !== undefined) data.tags = video.tags;
  if (video.views !== undefined) data.views = video.views;
  if (video.trialEnabled !== undefined) data.trial_enabled = video.trialEnabled;
  if (video.trialDurationValue !== undefined) data.trial_duration_value = video.trialDurationValue;
  if (video.trialDurationUnit !== undefined) data.trial_duration_unit = video.trialDurationUnit;
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
  const durationValue =
    typeof row.duration_value === "number"
      ? row.duration_value
      : (row.duration_days ?? 1);
  const durationUnit = (row.duration_unit ??
    inferPlanDurationUnit(row.duration_days ?? 1, row.type)) as PlanDurationUnit;

  return {
    id: row.id,
    name: row.name,
    type: row.type ?? undefined,
    price: row.price,
    durationValue,
    durationUnit,
    durationDays: row.duration_days ?? durationToDays(durationValue, durationUnit),
    durationLabel: row.duration_label || formatDurationLabel(durationValue, durationUnit),
    currency: row.currency ?? "TZS",
    features: row.features ?? [],
    isActive: row.is_active ?? true,
    popular: row.popular ?? false,
  };
}

export function mapVipPlanToDb(plan: Partial<VipPlan>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (plan.name !== undefined) data.name = plan.name;
  if (plan.price !== undefined) data.price = plan.price;
  if (plan.currency !== undefined) data.currency = plan.currency;
  if (plan.features !== undefined) data.features = plan.features;
  if (plan.isActive !== undefined) data.is_active = plan.isActive;
  if (plan.popular !== undefined) data.popular = plan.popular;
  if (plan.type !== undefined) data.type = plan.type;

  if (plan.durationValue !== undefined && plan.durationUnit !== undefined) {
    data.duration_value = plan.durationValue;
    data.duration_unit = plan.durationUnit;
    data.duration_days = durationToDays(plan.durationValue, plan.durationUnit);
    data.duration_label = formatDurationLabel(plan.durationValue, plan.durationUnit);
  } else if (plan.durationDays !== undefined) {
    data.duration_days = plan.durationDays;
  }

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
    isCurrent: row.is_current ?? row.id === "current",
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

export function mapVideoReport(row: Record<string, any>): VideoReport {
  const video = row.videos as Record<string, unknown> | null | undefined;
  return {
    id: row.id,
    videoId: row.video_id,
    videoTitle: (video?.title as string) ?? row.video_id,
    reason: row.reason,
    details: row.details ?? "",
    deviceId: row.device_id ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapVideoLikeStat(row: Record<string, any>): VideoLikeStat {
  return {
    id: row.id,
    title: row.title,
    likesCount: row.likes_count ?? 0,
    views: row.views ?? 0,
    categoryName: row.category_name ?? "",
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
    vipTrial: {
      enabled: row.vip_trial_enabled ?? false,
      durationValue: row.vip_trial_duration_value ?? 5,
      durationUnit: row.vip_trial_duration_unit ?? "minutes",
    },
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
  if (s.vipTrial?.enabled !== undefined) data.vip_trial_enabled = s.vipTrial.enabled;
  if (s.vipTrial?.durationValue !== undefined) data.vip_trial_duration_value = s.vipTrial.durationValue;
  if (s.vipTrial?.durationUnit !== undefined) data.vip_trial_duration_unit = s.vipTrial.durationUnit;
  return data;
}

export function mapVipTrialSettings(row: Record<string, any>) {
  return {
    enabled: row.vip_trial_enabled ?? false,
    durationValue: row.vip_trial_duration_value ?? 5,
    durationUnit: row.vip_trial_duration_unit ?? "minutes",
  };
}

export function mapVipTrialSettingsToDb(settings: Partial<import("@/types").VipTrialSettings>) {
  const data: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (settings.enabled !== undefined) data.vip_trial_enabled = settings.enabled;
  if (settings.durationValue !== undefined) data.vip_trial_duration_value = settings.durationValue;
  if (settings.durationUnit !== undefined) data.vip_trial_duration_unit = settings.durationUnit;
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
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  const [videosRes, categoriesRes, paymentsRes, likedRes] = await Promise.all([
    db.from("videos").select("id, title, views, category_id, created_at").order("views", { ascending: false }),
    db.from("categories").select("id, name"),
    db
      .from("payments")
      .select("amount, status, created_at")
      .eq("status", "completed")
      .gte("created_at", thirtyDaysAgo.toISOString()),
    db
      .from("videos")
      .select("id, title, views, likes_count")
      .order("likes_count", { ascending: false })
      .limit(20),
  ]);

  const videos = videosRes.data ?? [];
  const likedVideos = likedRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  const dailyViews = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return { date: d.toISOString().split("T")[0], views: 0 };
  });

  const revenueByDate = new Map<string, number>();
  for (const payment of payments) {
    const date = String(payment.created_at).split("T")[0];
    revenueByDate.set(date, (revenueByDate.get(date) ?? 0) + (payment.amount ?? 0));
  }

  const revenueChart = dailyViews.map(({ date }) => ({
    date,
    revenue: revenueByDate.get(date) ?? 0,
  }));

  const weeklyViews = Array.from({ length: 12 }, (_, i) => ({
    week: `Week ${i + 1}`,
    views: 0,
  }));

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyViews = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { month: monthNames[d.getMonth()], views: 0 };
  });

  const viewsByCategory = new Map<string, number>();
  const countByCategory = new Map<string, number>();
  for (const video of videos) {
    const categoryId = video.category_id as string | null;
    if (!categoryId) continue;
    viewsByCategory.set(categoryId, (viewsByCategory.get(categoryId) ?? 0) + (video.views ?? 0));
    countByCategory.set(categoryId, (countByCategory.get(categoryId) ?? 0) + 1);
  }

  return {
    dailyViews,
    weeklyViews,
    monthlyViews,
    revenueChart,
    topVideos: videos.slice(0, 5).map((video) => ({
      id: video.id as string,
      title: video.title as string,
      views: (video.views as number) ?? 0,
      revenue: 0,
    })),
    topCategories: categories
      .map((category) => ({
        id: category.id as string,
        name: category.name as string,
        views: viewsByCategory.get(category.id as string) ?? 0,
        videoCount: countByCategory.get(category.id as string) ?? 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5),
    topLikedVideos: likedVideos.map((video) => ({
      id: video.id as string,
      title: video.title as string,
      likesCount: (video.likes_count as number) ?? 0,
      views: (video.views as number) ?? 0,
    })),
  };
}
