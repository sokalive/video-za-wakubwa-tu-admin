export interface Admin {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "moderator";
  avatar?: string;
  lastLogin?: string;
  createdAt: string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  thumbnailUrl: string;
  videoUrl: string;
  trailerUrl?: string;
  duration: string;
  resolution: string;
  isVip: boolean;
  isFeatured: boolean;
  tags: string[];
  views: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  videoCount: number;
  thumbnailUrl?: string;
  createdAt: string;
}

export interface VipPlan {
  id: string;
  name: string;
  type: "daily" | "weekly" | "monthly";
  price: number;
  durationDays: number;
  features: string[];
  isActive: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isVip: boolean;
  vipExpiresAt?: string;
  isActive: boolean;
  totalSpent: number;
  joinedAt: string;
  lastActive: string;
}

export interface Payment {
  id: string;
  userId: string;
  userName: string;
  planId: string;
  planName: string;
  amount: number;
  status: "completed" | "pending" | "failed" | "refunded";
  method: string;
  createdAt: string;
}

export interface ApkRelease {
  id: string;
  version: string;
  fileUrl: string;
  fileSize: string;
  releaseNotes: string;
  screenshots: string[];
  forceUpdate: boolean;
  downloadCount: number;
  createdAt: string;
}

export interface Advertisement {
  id: string;
  title: string;
  type: "banner" | "popup";
  placement: "homepage" | "video_page" | "both";
  imageUrl: string;
  linkUrl?: string;
  isEnabled: boolean;
  impressions: number;
  clicks: number;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  entity: string;
  entityId?: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export interface DashboardStats {
  totalVideos: number;
  totalVipVideos: number;
  totalFreeVideos: number;
  totalUsers: number;
  totalVipUsers: number;
  totalRevenue: number;
  totalApkDownloads: number;
  totalViews: number;
}

export interface AnalyticsData {
  dailyViews: { date: string; views: number }[];
  weeklyViews: { week: string; views: number }[];
  monthlyViews: { month: string; views: number }[];
  revenueChart: { date: string; revenue: number }[];
  topVideos: { id: string; title: string; views: number; revenue: number }[];
  topCategories: { id: string; name: string; views: number; videoCount: number }[];
}

export interface SiteSettings {
  websiteName: string;
  logoUrl: string;
  homepageBannerUrl: string;
  footerText: string;
  contactEmail: string;
  contactPhone: string;
  socialLinks: { platform: string; url: string }[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
