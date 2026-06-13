export interface Admin {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "moderator";
  avatar?: string;
  lastLogin?: string;
  createdAt: string;
}

export type VideoStorage = "r2" | "google_drive";

export type PlanDurationUnit =
  | "seconds"
  | "minutes"
  | "hours"
  | "days"
  | "weeks"
  | "months";

export type TrialDurationUnit = "seconds" | "minutes" | "hours";

export interface Video {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  thumbnailUrl: string;
  videoUrl: string;
  r2ObjectKey: string;
  videoStorage: VideoStorage;
  googleDriveUrl: string;
  duration: string;
  resolution: string;
  isVip: boolean;
  vipTrialSeconds?: number | null;
  isFeatured: boolean;
  isPinned: boolean;
  pinOrder: number | null;
  autoplay: boolean;
  tags: string[];
  views: number;
  likesCount: number;
  trialEnabled: boolean;
  trialDurationValue: number;
  trialDurationUnit: TrialDurationUnit;
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
  type?: string;
  price: number;
  durationValue: number;
  durationUnit: PlanDurationUnit;
  durationDays: number;
  durationLabel: string;
  currency: string;
  features: string[];
  isActive: boolean;
  popular: boolean;
}

export interface VipTrialSettings {
  enabled: boolean;
  durationValue: number;
  durationUnit: TrialDurationUnit;
}

export interface SonicpesaSettings {
  enabled: boolean;
  environment: "live" | "sandbox";
  apiEndpoint: string;
  api_endpoint?: string;
  accountId: string;
  account_id?: string;
  apiKey?: string;
  webhookUrl: string;
  webhook_url?: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
  isActiveCheckoutProvider: boolean;
  payment_provider: string;
  lastTestAt: string | null;
  last_test_at?: string | null;
  lastTestOk: boolean | null;
  last_test_ok?: boolean | null;
  lastTestMessage: string;
  last_test_message?: string;
  lastWebhookAt: string | null;
  last_webhook_at?: string | null;
  lastWebhookEvent: string;
  last_webhook_event?: string;
  lastWebhookOrderId: string;
  last_webhook_order_id?: string;
  setAsActiveCheckoutProvider?: boolean;
  envOverrideAny?: boolean;
  envOverrideActive?: Record<string, boolean>;
}

export interface BillingTransaction {
  id: number;
  orderId: string;
  externalId: string | null;
  planId: string | null;
  planName: string;
  phone: string;
  amount: number;
  currency: string;
  status: string;
  deviceId: string | null;
  paymentProvider: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isVip: boolean;
  vipExpiresAt?: string;
  subscriptionStatus?: "active" | "pending" | "expired" | "none";
  isActive: boolean;
  totalSpent: number;
  transactionCount?: number;
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
  isCurrent?: boolean;
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
  totalCategories: number;
  totalUsers: number;
  totalViews: number;
}

export interface AnalyticsData {
  dailyViews: { date: string; views: number }[];
  weeklyViews: { week: string; views: number }[];
  monthlyViews: { month: string; views: number }[];
  revenueChart: { date: string; revenue: number }[];
  subscriptionGrowth?: { month: string; count: number }[];
  userGrowth?: { date: string; users: number }[];
  topVideos: { id: string; title: string; views: number; revenue: number }[];
  topCategories: { id: string; name: string; views: number; videoCount: number }[];
  topLikedVideos: { id: string; title: string; likesCount: number; views: number }[];
}

export interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  recalculatedAt: string;
}

export interface DeviceSubscription {
  deviceId: string;
  status: "active" | "pending";
  expiresAt: string;
  startedAt: string;
  transactionId: string;
  updatedAt: string;
  active: boolean;
  phone?: string;
  totalSpent: number;
}

export interface ApkReleaseHistory extends ApkRelease {
  isCurrent: boolean;
}

export interface VideoReport {
  id: string;
  videoId: string;
  videoTitle: string;
  reason: string;
  details: string;
  deviceId?: string;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
}

export interface VideoLikeStat {
  id: string;
  title: string;
  likesCount: number;
  views: number;
  categoryName: string;
}

export interface SiteSettings {
  websiteName: string;
  logoUrl: string;
  homepageBannerUrl: string;
  footerText: string;
  contactEmail: string;
  contactPhone: string;
  socialLinks: { platform: string; url: string }[];
  vipTrial: VipTrialSettings;
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
