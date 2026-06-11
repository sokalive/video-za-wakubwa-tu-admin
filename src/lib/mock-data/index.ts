import type {
  Admin,
  Video,
  Category,
  VipPlan,
  User,
  Payment,
  ApkRelease,
  Advertisement,
  ActivityLog,
  DashboardStats,
  AnalyticsData,
  SiteSettings,
} from "@/types";

export const MOCK_ADMIN: Admin = {
  id: "admin-1",
  name: "Super Admin",
  email: "admin@vzwakubwa.com",
  role: "super_admin",
  lastLogin: new Date().toISOString(),
  createdAt: "2024-01-01T00:00:00Z",
};

export const MOCK_ADMINS: Admin[] = [
  MOCK_ADMIN,
  {
    id: "admin-2",
    name: "Content Manager",
    email: "content@vzwakubwa.com",
    role: "admin",
    lastLogin: "2026-06-10T14:30:00Z",
    createdAt: "2024-03-15T00:00:00Z",
  },
  {
    id: "admin-3",
    name: "Moderator",
    email: "mod@vzwakubwa.com",
    role: "moderator",
    lastLogin: "2026-06-09T09:15:00Z",
    createdAt: "2024-06-20T00:00:00Z",
  },
];

export const MOCK_CATEGORIES: Category[] = [
  { id: "cat-1", name: "Action", slug: "action", description: "High-energy action content", videoCount: 45, createdAt: "2024-01-01T00:00:00Z" },
  { id: "cat-2", name: "Drama", slug: "drama", description: "Emotional drama series", videoCount: 38, createdAt: "2024-01-01T00:00:00Z" },
  { id: "cat-3", name: "Comedy", slug: "comedy", description: "Funny and entertaining", videoCount: 52, createdAt: "2024-01-01T00:00:00Z" },
  { id: "cat-4", name: "Romance", slug: "romance", description: "Love stories and romance", videoCount: 29, createdAt: "2024-02-01T00:00:00Z" },
  { id: "cat-5", name: "Thriller", slug: "thriller", description: "Suspense and thriller", videoCount: 33, createdAt: "2024-02-15T00:00:00Z" },
  { id: "cat-6", name: "Documentary", slug: "documentary", description: "Real life documentaries", videoCount: 18, createdAt: "2024-03-01T00:00:00Z" },
];

export const MOCK_VIDEOS: Video[] = [
  {
    id: "vid-1",
    title: "Midnight Chronicles",
    description: "An epic tale of adventure and mystery under the stars.",
    categoryId: "cat-1",
    categoryName: "Action",
    thumbnailUrl: "https://picsum.photos/seed/vid1/640/360",
    videoUrl: "/videos/midnight-chronicles.mp4",
    trailerUrl: "/trailers/midnight-chronicles-trailer.mp4",
    duration: "1:45:30",
    resolution: "1080p",
    isVip: true,
    isFeatured: true,
    tags: ["action", "adventure", "featured"],
    views: 125430,
    createdAt: "2025-12-01T10:00:00Z",
    updatedAt: "2026-06-01T08:00:00Z",
  },
  {
    id: "vid-2",
    title: "Love in the City",
    description: "A romantic story set in the bustling streets of Dar es Salaam.",
    categoryId: "cat-4",
    categoryName: "Romance",
    thumbnailUrl: "https://picsum.photos/seed/vid2/640/360",
    videoUrl: "/videos/love-in-city.mp4",
    duration: "2:10:15",
    resolution: "1080p",
    isVip: false,
    isFeatured: true,
    tags: ["romance", "drama"],
    views: 98760,
    createdAt: "2025-11-15T14:00:00Z",
    updatedAt: "2026-05-20T12:00:00Z",
  },
  {
    id: "vid-3",
    title: "Comedy Night Live",
    description: "The best stand-up comedy from Tanzania's top comedians.",
    categoryId: "cat-3",
    categoryName: "Comedy",
    thumbnailUrl: "https://picsum.photos/seed/vid3/640/360",
    videoUrl: "/videos/comedy-night.mp4",
    duration: "1:30:00",
    resolution: "720p",
    isVip: true,
    isFeatured: false,
    tags: ["comedy", "live"],
    views: 76540,
    createdAt: "2026-01-10T09:00:00Z",
    updatedAt: "2026-06-05T16:00:00Z",
  },
  {
    id: "vid-4",
    title: "Dark Waters",
    description: "A psychological thriller that will keep you on the edge.",
    categoryId: "cat-5",
    categoryName: "Thriller",
    thumbnailUrl: "https://picsum.photos/seed/vid4/640/360",
    videoUrl: "/videos/dark-waters.mp4",
    trailerUrl: "/trailers/dark-waters-trailer.mp4",
    duration: "1:55:45",
    resolution: "1080p",
    isVip: true,
    isFeatured: false,
    tags: ["thriller", "suspense"],
    views: 54320,
    createdAt: "2026-02-20T11:00:00Z",
    updatedAt: "2026-06-08T10:00:00Z",
  },
  {
    id: "vid-5",
    title: "Family Ties",
    description: "Heartwarming family drama spanning generations.",
    categoryId: "cat-2",
    categoryName: "Drama",
    thumbnailUrl: "https://picsum.photos/seed/vid5/640/360",
    videoUrl: "/videos/family-ties.mp4",
    duration: "2:25:00",
    resolution: "1080p",
    isVip: false,
    isFeatured: false,
    tags: ["drama", "family"],
    views: 43210,
    createdAt: "2026-03-05T08:00:00Z",
    updatedAt: "2026-06-02T14:00:00Z",
  },
  {
    id: "vid-6",
    title: "Wild Tanzania",
    description: "Stunning documentary about Tanzania's wildlife.",
    categoryId: "cat-6",
    categoryName: "Documentary",
    thumbnailUrl: "https://picsum.photos/seed/vid6/640/360",
    videoUrl: "/videos/wild-tanzania.mp4",
    duration: "1:20:30",
    resolution: "4K",
    isVip: false,
    isFeatured: true,
    tags: ["documentary", "nature"],
    views: 89100,
    createdAt: "2026-04-01T07:00:00Z",
    updatedAt: "2026-06-10T09:00:00Z",
  },
];

export const MOCK_VIP_PLANS: VipPlan[] = [
  {
    id: "plan-1",
    name: "Daily VIP",
    type: "daily",
    price: 2000,
    durationDays: 1,
    features: ["HD Streaming", "No Ads", "All VIP Content"],
    isActive: true,
  },
  {
    id: "plan-2",
    name: "Weekly VIP",
    type: "weekly",
    price: 10000,
    durationDays: 7,
    features: ["HD Streaming", "No Ads", "All VIP Content", "Early Access"],
    isActive: true,
  },
  {
    id: "plan-3",
    name: "Monthly VIP",
    type: "monthly",
    price: 30000,
    durationDays: 30,
    features: ["4K Streaming", "No Ads", "All VIP Content", "Early Access", "Download"],
    isActive: true,
  },
];

export const MOCK_USERS: User[] = [
  { id: "user-1", name: "John Mwangi", email: "john@email.com", phone: "+255712345678", isVip: true, vipExpiresAt: "2026-07-01T00:00:00Z", isActive: true, totalSpent: 45000, joinedAt: "2025-06-01T00:00:00Z", lastActive: "2026-06-11T08:00:00Z" },
  { id: "user-2", name: "Sarah Hassan", email: "sarah@email.com", phone: "+255723456789", isVip: false, isActive: true, totalSpent: 0, joinedAt: "2025-08-15T00:00:00Z", lastActive: "2026-06-10T19:00:00Z" },
  { id: "user-3", name: "Peter Kimaro", email: "peter@email.com", phone: "+255734567890", isVip: true, vipExpiresAt: "2026-06-20T00:00:00Z", isActive: true, totalSpent: 30000, joinedAt: "2025-09-20T00:00:00Z", lastActive: "2026-06-11T06:30:00Z" },
  { id: "user-4", name: "Grace Mushi", email: "grace@email.com", isVip: false, isActive: false, totalSpent: 2000, joinedAt: "2025-10-05T00:00:00Z", lastActive: "2026-05-01T12:00:00Z" },
  { id: "user-5", name: "David Ole", email: "david@email.com", phone: "+255745678901", isVip: true, vipExpiresAt: "2026-08-15T00:00:00Z", isActive: true, totalSpent: 90000, joinedAt: "2025-04-10T00:00:00Z", lastActive: "2026-06-11T10:00:00Z" },
];

export const MOCK_PAYMENTS: Payment[] = [
  { id: "pay-1", userId: "user-1", userName: "John Mwangi", planId: "plan-3", planName: "Monthly VIP", amount: 30000, status: "completed", method: "M-Pesa", createdAt: "2026-06-01T10:30:00Z" },
  { id: "pay-2", userId: "user-3", userName: "Peter Kimaro", planId: "plan-3", planName: "Monthly VIP", amount: 30000, status: "completed", method: "Tigo Pesa", createdAt: "2026-05-20T14:15:00Z" },
  { id: "pay-3", userId: "user-5", userName: "David Ole", planId: "plan-2", planName: "Weekly VIP", amount: 10000, status: "completed", method: "M-Pesa", createdAt: "2026-06-08T09:00:00Z" },
  { id: "pay-4", userId: "user-2", userName: "Sarah Hassan", planId: "plan-1", planName: "Daily VIP", amount: 2000, status: "pending", method: "Airtel Money", createdAt: "2026-06-11T07:45:00Z" },
  { id: "pay-5", userId: "user-4", userName: "Grace Mushi", planId: "plan-1", planName: "Daily VIP", amount: 2000, status: "failed", method: "M-Pesa", createdAt: "2026-05-01T16:20:00Z" },
];

export const MOCK_APK: ApkRelease = {
  id: "apk-1",
  version: "2.4.1",
  fileUrl: "/apk/vzwakubwa-v2.4.1.apk",
  fileSize: "28.5 MB",
  releaseNotes: "- Fixed streaming buffer issues\n- Added dark mode\n- Performance improvements\n- Bug fixes",
  screenshots: [
    "https://picsum.photos/seed/ss1/360/640",
    "https://picsum.photos/seed/ss2/360/640",
    "https://picsum.photos/seed/ss3/360/640",
  ],
  forceUpdate: false,
  downloadCount: 45230,
  createdAt: "2026-06-01T00:00:00Z",
};

export const MOCK_ADS: Advertisement[] = [
  { id: "ad-1", title: "Summer Sale Banner", type: "banner", placement: "homepage", imageUrl: "https://picsum.photos/seed/ad1/728/90", linkUrl: "https://example.com/sale", isEnabled: true, impressions: 125000, clicks: 3200, createdAt: "2026-05-01T00:00:00Z" },
  { id: "ad-2", title: "VIP Upgrade Popup", type: "popup", placement: "video_page", imageUrl: "https://picsum.photos/seed/ad2/400/300", isEnabled: true, impressions: 89000, clicks: 4500, createdAt: "2026-05-15T00:00:00Z" },
  { id: "ad-3", title: "Partner Promo", type: "banner", placement: "both", imageUrl: "https://picsum.photos/seed/ad3/728/90", linkUrl: "https://example.com/partner", isEnabled: false, impressions: 45000, clicks: 890, createdAt: "2026-04-01T00:00:00Z" },
];

export const MOCK_ACTIVITY_LOGS: ActivityLog[] = [
  { id: "log-1", adminId: "admin-1", adminName: "Super Admin", action: "upload", entity: "video", entityId: "vid-6", details: "Uploaded video: Wild Tanzania", ipAddress: "192.168.1.1", createdAt: "2026-06-10T09:00:00Z" },
  { id: "log-2", adminId: "admin-2", adminName: "Content Manager", action: "edit", entity: "video", entityId: "vid-1", details: "Updated video: Midnight Chronicles", ipAddress: "192.168.1.2", createdAt: "2026-06-09T14:30:00Z" },
  { id: "log-3", adminId: "admin-1", adminName: "Super Admin", action: "delete", entity: "video", entityId: "vid-old", details: "Deleted video: Old Content", ipAddress: "192.168.1.1", createdAt: "2026-06-08T11:00:00Z" },
  { id: "log-4", adminId: "admin-1", adminName: "Super Admin", action: "update", entity: "apk", entityId: "apk-1", details: "Updated APK to version 2.4.1", ipAddress: "192.168.1.1", createdAt: "2026-06-01T00:00:00Z" },
  { id: "log-5", adminId: "admin-1", adminName: "Super Admin", action: "payment", entity: "payment", entityId: "pay-1", details: "Payment completed: John Mwangi - Monthly VIP", ipAddress: "192.168.1.1", createdAt: "2026-06-01T10:30:00Z" },
  { id: "log-6", adminId: "admin-3", adminName: "Moderator", action: "edit", entity: "user", entityId: "user-4", details: "Deactivated user: Grace Mushi", ipAddress: "192.168.1.3", createdAt: "2026-05-01T12:00:00Z" },
];

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  totalVideos: 215,
  totalVipVideos: 128,
  totalFreeVideos: 87,
  totalUsers: 15420,
  totalVipUsers: 3240,
  totalRevenue: 45800000,
  totalApkDownloads: 45230,
  totalViews: 2845000,
};

export const MOCK_ANALYTICS: AnalyticsData = {
  dailyViews: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split("T")[0],
    views: Math.floor(Math.random() * 50000) + 30000,
  })),
  weeklyViews: Array.from({ length: 12 }, (_, i) => ({
    week: `Week ${i + 1}`,
    views: Math.floor(Math.random() * 200000) + 150000,
  })),
  monthlyViews: [
    { month: "Jan", views: 820000 },
    { month: "Feb", views: 910000 },
    { month: "Mar", views: 1050000 },
    { month: "Apr", views: 980000 },
    { month: "May", views: 1120000 },
    { month: "Jun", views: 890000 },
  ],
  revenueChart: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split("T")[0],
    revenue: Math.floor(Math.random() * 2000000) + 500000,
  })),
  topVideos: MOCK_VIDEOS.slice(0, 5).map((v) => ({
    id: v.id,
    title: v.title,
    views: v.views,
    revenue: Math.floor(v.views * 0.05),
  })),
  topCategories: MOCK_CATEGORIES.slice(0, 5).map((c) => ({
    id: c.id,
    name: c.name,
    views: Math.floor(Math.random() * 500000) + 100000,
    videoCount: c.videoCount,
  })),
};

export const MOCK_SETTINGS: SiteSettings = {
  websiteName: "Video Za Wakubwa Tu",
  logoUrl: "/logo.png",
  homepageBannerUrl: "https://picsum.photos/seed/banner/1920/600",
  footerText: "© 2026 Video Za Wakubwa Tu. All rights reserved.",
  contactEmail: "support@vzwakubwa.com",
  contactPhone: "+255 700 000 000",
  socialLinks: [
    { platform: "Facebook", url: "https://facebook.com/vzwakubwa" },
    { platform: "Instagram", url: "https://instagram.com/vzwakubwa" },
    { platform: "Twitter", url: "https://twitter.com/vzwakubwa" },
  ],
};

// In-memory store for mock CRUD operations
export const mockStore = {
  videos: [...MOCK_VIDEOS],
  categories: [...MOCK_CATEGORIES],
  vipPlans: [...MOCK_VIP_PLANS],
  users: [...MOCK_USERS],
  payments: [...MOCK_PAYMENTS],
  ads: [...MOCK_ADS],
  admins: [...MOCK_ADMINS],
  activityLogs: [...MOCK_ACTIVITY_LOGS],
  settings: { ...MOCK_SETTINGS },
  apk: { ...MOCK_APK },
};
