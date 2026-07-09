import { getSupabaseAdmin } from "./client";
import { supabaseRest } from "./rest";
import { listTransactionsAdmin } from "@/lib/payments/billing-store";
import {
  getRevenueResetAt,
  transactionCountsTowardRevenue,
} from "@/lib/db/revenue-baseline";
import type { AnalyticsData, BillingTransaction, DashboardStats, User } from "@/types";

type TxnRow = {
  device_id: string | null;
  phone: string;
  amount: number;
  status: string;
  created_at: string;
  plan_id: string | null;
};

type SubRow = {
  device_id: string;
  status: string;
  expires_at: string;
  started_at: string;
  updated_at: string;
  transaction_id: string;
};

type ViewRow = {
  device_id: string;
  last_viewed_at: string;
};

function dateKey(iso: string): string {
  return String(iso).split("T")[0];
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function weekLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function safeRest<T>(path: string): Promise<T[]> {
  const { data, error } = await supabaseRest<T[]>(path);
  if (error) {
    if (/relation|schema cache|does not exist/i.test(error)) return [];
    throw new Error(error);
  }
  return data ?? [];
}

export async function computePaymentStats() {
  const [rows, revenueResetAt] = await Promise.all([
    listTransactionsAdmin(),
    getRevenueResetAt(),
  ]);
  const completed = rows.filter((r) =>
    transactionCountsTowardRevenue(r.created_at, r.status, revenueResetAt)
  );
  const pending = rows.filter((r) => r.status === "pending");
  const failed = rows.filter((r) => r.status === "failed");
  const totalRevenue = completed.reduce((s, r) => s + (r.amount ?? 0), 0);
  return {
    totalRevenue,
    totalTransactions: rows.length,
    completedCount: rows.filter((r) => r.status === "completed").length,
    pendingCount: pending.length,
    failedCount: failed.length,
    recalculatedAt: new Date().toISOString(),
    revenueResetAt,
  };
}

export async function listBillingTransactions(status?: string): Promise<BillingTransaction[]> {
  const rows = await listTransactionsAdmin(status && status !== "all" ? { status } : {});
  return rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    externalId: row.external_id,
    planId: row.plan_id,
    planName: row.vip_plans?.name ?? "",
    phone: row.phone,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    deviceId: row.device_id,
    paymentProvider:
      row.raw_payload && typeof row.raw_payload === "object"
        ? (String((row.raw_payload as Record<string, unknown>).payment_provider ?? "") || null)
        : null,
    createdAt: row.created_at,
  }));
}

export async function listDeviceUsers(filters?: {
  search?: string;
  isVip?: boolean;
  isActive?: boolean;
}): Promise<User[]> {
  const [txns, subs, views] = await Promise.all([
    safeRest<TxnRow>("transactions?select=device_id,phone,amount,status,created_at,plan_id&order=created_at.desc"),
    safeRest<SubRow>("device_subscriptions?select=*"),
    safeRest<ViewRow>("video_view_sessions?select=device_id,last_viewed_at"),
  ]);

  const subByDevice = new Map(subs.map((s) => [s.device_id, s]));
  const now = Date.now();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const activeWindowMs = 30 * MS_PER_DAY;

  type Agg = {
    deviceId: string;
    phone: string;
    totalSpent: number;
    firstSeen: string;
    lastActive: string;
    txnCount: number;
  };

  const devices = new Map<string, Agg>();

  const touch = (deviceId: string, ts: string, phone?: string, spent?: number) => {
    const id = deviceId.trim();
    if (!id) return;
    const cur = devices.get(id) ?? {
      deviceId: id,
      phone: "",
      totalSpent: 0,
      firstSeen: ts,
      lastActive: ts,
      txnCount: 0,
    };
    if (phone && !cur.phone) cur.phone = phone;
    if (spent) cur.totalSpent += spent;
    if (ts < cur.firstSeen) cur.firstSeen = ts;
    if (ts > cur.lastActive) cur.lastActive = ts;
    devices.set(id, cur);
  };

  for (const t of txns) {
    if (!t.device_id) continue;
    touch(t.device_id, t.created_at, t.phone, t.status === "completed" ? t.amount : 0);
    const cur = devices.get(t.device_id)!;
    cur.txnCount += 1;
  }

  for (const v of views) {
    touch(v.device_id, v.last_viewed_at);
  }

  for (const s of subs) {
    touch(s.device_id, s.updated_at || s.started_at);
  }

  let users: User[] = [...devices.values()].map((d) => {
    const sub = subByDevice.get(d.deviceId);
    const expiresMs = sub?.expires_at ? new Date(sub.expires_at).getTime() : 0;
    const vipActive = sub?.status === "active" && expiresMs > now;
    const lastMs = new Date(d.lastActive).getTime();
    const isActive = now - lastMs <= activeWindowMs;
    const shortId = d.deviceId.length > 12 ? `${d.deviceId.slice(0, 8)}…` : d.deviceId;

    let subscriptionStatus: User["subscriptionStatus"] = "none";
    if (sub) {
      if (vipActive) subscriptionStatus = "active";
      else if (sub.status === "pending") subscriptionStatus = "pending";
      else subscriptionStatus = "expired";
    }

    return {
      id: d.deviceId,
      name: d.phone ? `User ${d.phone.replace(/\D/g, "").slice(-9)}` : `Device ${shortId}`,
      email: d.deviceId,
      phone: d.phone || undefined,
      isVip: vipActive,
      vipExpiresAt: sub?.expires_at,
      subscriptionStatus,
      isActive,
      totalSpent: d.totalSpent,
      transactionCount: d.txnCount,
      joinedAt: d.firstSeen,
      lastActive: d.lastActive,
    };
  });

  users.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone ?? "").includes(q)
    );
  }
  if (filters?.isVip !== undefined) {
    users = users.filter((u) => u.isVip === filters.isVip);
  }
  if (filters?.isActive !== undefined) {
    users = users.filter((u) => u.isActive === filters.isActive);
  }

  return users;
}

export async function getDeviceUserStats(filters?: {
  search?: string;
  isVip?: boolean;
  isActive?: boolean;
}) {
  const users = await listDeviceUsers(filters);
  return {
    total: users.length,
    vip: users.filter((u) => u.isVip).length,
    active: users.filter((u) => u.isActive).length,
    paying: users.filter((u) => (u.transactionCount ?? 0) > 0).length,
  };
}

export async function computeDashboardStatsFromDb(): Promise<DashboardStats> {
  const db = getSupabaseAdmin();
  const [videosRes, categoriesRes, userStats] = await Promise.all([
    db.from("videos").select("is_vip, views"),
    db.from("categories").select("id"),
    getDeviceUserStats(),
  ]);

  const vids = videosRes.data ?? [];

  return {
    totalVideos: vids.length,
    totalVipVideos: vids.filter((v) => v.is_vip).length,
    totalFreeVideos: vids.filter((v) => !v.is_vip).length,
    totalCategories: categoriesRes.data?.length ?? 0,
    totalUsers: userStats.total,
    totalViews: vids.reduce((s, v) => s + (v.views ?? 0), 0),
  };
}

export async function computeAnalyticsFromDb(): Promise<AnalyticsData> {
  const db = getSupabaseAdmin();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 7 * 11);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

  const [videosRes, categoriesRes, likedRes, viewSessions, txns, subs] = await Promise.all([
    db.from("videos").select("id, title, views, category_id, created_at").order("views", { ascending: false }),
    db.from("categories").select("id, name"),
    db.from("videos").select("id, title, views, likes_count").order("likes_count", { ascending: false }).limit(20),
    safeRest<ViewRow>(
      `video_view_sessions?select=device_id,last_viewed_at&last_viewed_at=gte.${encodeURIComponent(sixMonthsAgo.toISOString())}`
    ),
    safeRest<TxnRow>(
      `transactions?select=amount,status,created_at,device_id&status=eq.completed&created_at=gte.${encodeURIComponent(thirtyDaysAgo.toISOString())}`
    ),
    safeRest<SubRow>(
      `device_subscriptions?select=device_id,status,expires_at,started_at,updated_at,transaction_id&started_at=gte.${encodeURIComponent(sixMonthsAgo.toISOString())}`
    ),
  ]);

  const videos = videosRes.data ?? [];
  const likedVideos = likedRes.data ?? [];
  const categories = categoriesRes.data ?? [];

  const dailyViewsMap = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    dailyViewsMap.set(d.toISOString().split("T")[0], 0);
  }
  for (const s of viewSessions) {
    const key = dateKey(s.last_viewed_at);
    if (dailyViewsMap.has(key)) {
      dailyViewsMap.set(key, (dailyViewsMap.get(key) ?? 0) + 1);
    }
  }
  const dailyViews = [...dailyViewsMap.entries()].map(([date, views]) => ({ date, views }));

  const weeklyViewsMap = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (11 - i) * 7);
    weeklyViewsMap.set(weekLabel(d.toISOString()), 0);
  }
  for (const s of viewSessions) {
    if (new Date(s.last_viewed_at) < twelveWeeksAgo) continue;
    const d = new Date(s.last_viewed_at);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const label = weekLabel(weekStart.toISOString());
    if ([...weeklyViewsMap.keys()].includes(label) || weeklyViewsMap.size < 12) {
      weeklyViewsMap.set(label, (weeklyViewsMap.get(label) ?? 0) + 1);
    }
  }
  const weeklyViews = [...weeklyViewsMap.entries()].slice(-12).map(([week, views]) => ({ week, views }));

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyViewsMap = new Map<string, number>();
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    monthlyViewsMap.set(monthNames[d.getMonth()], 0);
  }
  for (const s of viewSessions) {
    const d = new Date(s.last_viewed_at);
    const label = monthNames[d.getMonth()];
    if (monthlyViewsMap.has(label)) {
      monthlyViewsMap.set(label, (monthlyViewsMap.get(label) ?? 0) + 1);
    }
  }
  const monthlyViews = [...monthlyViewsMap.entries()].map(([month, views]) => ({ month, views }));

  const revenueByDate = new Map<string, number>();
  for (const date of dailyViewsMap.keys()) {
    revenueByDate.set(date, 0);
  }
  for (const t of txns) {
    const key = dateKey(t.created_at);
    revenueByDate.set(key, (revenueByDate.get(key) ?? 0) + (t.amount ?? 0));
  }
  const revenueChart = [...dailyViewsMap.keys()].map((date) => ({
    date,
    revenue: revenueByDate.get(date) ?? 0,
  }));

  const subsByMonth = new Map<string, number>();
  for (const label of monthlyViewsMap.keys()) subsByMonth.set(label, 0);
  for (const s of subs) {
    const d = new Date(s.started_at);
    const label = monthNames[d.getMonth()];
    subsByMonth.set(label, (subsByMonth.get(label) ?? 0) + 1);
  }
  const subscriptionGrowth = [...subsByMonth.entries()].map(([month, count]) => ({ month, count }));

  const userGrowthMap = new Map<string, number>();
  for (const key of dailyViewsMap.keys()) userGrowthMap.set(key, 0);
  const seenDevices = new Set<string>();
  const allTxns = await safeRest<TxnRow>("transactions?select=device_id,created_at&order=created_at.asc");
  for (const t of allTxns) {
    if (!t.device_id || seenDevices.has(t.device_id)) continue;
    seenDevices.add(t.device_id);
    const key = dateKey(t.created_at);
    if (userGrowthMap.has(key)) {
      userGrowthMap.set(key, (userGrowthMap.get(key) ?? 0) + 1);
    }
  }
  const userGrowth = [...userGrowthMap.entries()].map(([date, users]) => ({ date, users }));

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
    subscriptionGrowth,
    userGrowth,
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
