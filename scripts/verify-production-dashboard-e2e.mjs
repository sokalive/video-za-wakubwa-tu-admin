/**
 * Full production admin dashboard verification (post 009 + 010 migrations).
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const adminUrl = (process.env.ADMIN_URL || "https://video-za-wakubwa-tu-admin.vercel.app").replace(/\/$/, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

for (const f of [join(__dirname, "..", ".env.production.local"), join(__dirname, "..", ".env.local")]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const email = process.env.ADMIN_EMAIL || "waziriissa37@gmail.com";
const password = process.env.ADMIN_PASSWORD || "Isamu2025";
const testDeviceId = `verify-dash-${Date.now()}`;

function extractCookie(h) {
  if (!h) return "";
  return (Array.isArray(h) ? h : [h]).map((c) => c.split(";")[0]).join("; ");
}

async function login() {
  const res = await fetch(`${adminUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  const cookie = extractCookie(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie"));
  if (!cookie) throw new Error("No session cookie");
  return cookie;
}

async function apiGet(path, cookie) {
  const res = await fetch(`${adminUrl}${path}`, { headers: { Cookie: cookie }, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiPost(path, cookie, payload) {
  const res = await fetch(`${adminUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function restTable(table, select, filter = "") {
  if (!supabaseUrl || !serviceKey) return { error: "no env", data: [] };
  const url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}${filter}`;
  const res = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) return { error: (await res.text()).slice(0, 200), data: [] };
  return { data: await res.json() };
}

function sumCompleted(txns) {
  return txns.filter((t) => t.status === "completed").reduce((s, t) => s + (Number(t.amount) || 0), 0);
}

function hasNonZeroSeries(series, key) {
  return Array.isArray(series) && series.some((r) => Number(r[key]) > 0);
}

const report = { adminUrl, testDeviceId, checks: {}, blockers: [] };

console.log("=== Production Admin Dashboard Verification ===\n");

const cookie = await login();
report.login = { ok: true };

// 1. Dashboard stats
console.log("1. Dashboard stats");
const stats = await apiGet("/api/dashboard/stats", cookie);
report.dashboardStats = stats;
const s = stats.body?.data ?? {};
report.checks.dashboardStats =
  stats.status === 200 &&
  typeof s.totalVideos === "number" &&
  typeof s.totalUsers === "number" &&
  typeof s.totalViews === "number";

// 2. Users
console.log("2. Users");
const users = await apiGet("/api/users", cookie);
report.users = {
  status: users.status,
  stats: users.body?.stats,
  count: (users.body?.data ?? []).length,
  sample: (users.body?.data ?? []).slice(0, 3),
};
report.checks.users =
  users.status === 200 &&
  users.body?.stats &&
  typeof users.body.stats.total === "number";

// 3. Payments + revenue cross-check
console.log("3. Payments");
const payments = await apiGet("/api/payments", cookie);
const txnsDirect = await restTable("transactions", "id,amount,status,created_at", "&order=created_at.desc");
const completedDirect = (txnsDirect.data ?? []).filter((t) => t.status === "completed");
const directRevenue = sumCompleted(txnsDirect.data ?? []);
const apiRevenue = payments.body?.stats?.totalRevenue ?? 0;

report.payments = {
  status: payments.status,
  stats: payments.body?.stats,
  count: (payments.body?.data ?? []).length,
  sample: (payments.body?.data ?? []).slice(0, 3),
  directTxnCount: (txnsDirect.data ?? []).length,
  directCompletedCount: completedDirect.length,
  directRevenue,
  apiRevenue,
  revenueMatch: directRevenue === apiRevenue,
};
report.checks.payments =
  payments.status === 200 &&
  Array.isArray(payments.body?.data) &&
  directRevenue === apiRevenue;

if (!report.checks.payments && payments.status === 200) {
  report.blockers.push(`Revenue mismatch: API=${apiRevenue} vs DB=${directRevenue}`);
}

// 4. Analytics (not hardcoded)
console.log("4. Analytics");
const analytics = await apiGet("/api/analytics", cookie);
const a = analytics.body?.data ?? {};
const viewSessions = await restTable("video_view_sessions", "device_id,last_viewed_at", "&limit=5");
const allZeroDaily = (a.dailyViews ?? []).every((r) => r.views === 0);
const dbHasSessions = (viewSessions.data ?? []).length > 0;

report.analytics = {
  status: analytics.status,
  dailyViewsSample: (a.dailyViews ?? []).slice(-5),
  revenueSample: (a.revenueChart ?? []).filter((r) => r.revenue > 0).slice(0, 5),
  subscriptionGrowth: a.subscriptionGrowth,
  userGrowth: a.userGrowth?.filter((r) => r.users > 0).slice(0, 5),
  topVideos: (a.topVideos ?? []).slice(0, 3),
  viewSessionsInDb: viewSessions.data?.length ?? 0,
  allZeroDaily,
  hasRevenueData: hasNonZeroSeries(a.revenueChart, "revenue"),
};
report.checks.analytics =
  analytics.status === 200 &&
  Array.isArray(a.dailyViews) &&
  a.dailyViews.length === 30 &&
  !(a.dailyViews[0]?.views === 0 && a.dailyViews.every((r, i, arr) => r.views === arr[0]?.views && i > 0 && false));

// Fix check: analytics returns 30 days structure, revenue from transactions not hardcoded placeholder
report.checks.analytics =
  analytics.status === 200 &&
  Array.isArray(a.dailyViews) &&
  a.dailyViews.length === 30 &&
  Array.isArray(a.revenueChart) &&
  (report.payments.directCompletedCount === 0 || hasNonZeroSeries(a.revenueChart, "revenue"));

if (allZeroDaily && dbHasSessions) {
  report.blockers.push("Analytics dailyViews all zero but video_view_sessions has rows — date bucketing may be off");
}

// 5. APK
console.log("5. APK");
const apk = await apiGet("/api/apk", cookie);
const apkHistory = await apiGet("/api/apk?history=1", cookie);
report.apk = {
  current: apk.body?.data,
  historyCount: (apkHistory.body?.data ?? []).length,
  historySample: (apkHistory.body?.data ?? []).slice(0, 3),
};
report.checks.apk =
  apk.status === 200 &&
  apkHistory.status === 200 &&
  Array.isArray(apkHistory.body?.data);

// 6. Subscription management lifecycle
console.log("6. VIP subscription management");
const subTests = {};

// activate with plan-daily (3 days via extend later)
const activate = await apiPost("/api/subscriptions", cookie, {
  deviceId: testDeviceId,
  action: "activate",
  planId: "plan-daily",
});
subTests.activate = { status: activate.status, data: activate.body?.data };
let expiresAt = activate.body?.data?.expiresAt;

const afterActivate = await apiGet("/api/subscriptions", cookie);
const activeRow = (afterActivate.body?.data ?? []).find((r) => r.deviceId === testDeviceId);
subTests.afterActivate = activeRow;

// extend 2 days
const extend = await apiPost("/api/subscriptions", cookie, {
  deviceId: testDeviceId,
  action: "extend",
  days: 2,
});
subTests.extend = { status: extend.status, data: extend.body?.data };
const expiresAfterExtend = extend.body?.data?.expiresAt;

// reduce 1 day
const reduce = await apiPost("/api/subscriptions", cookie, {
  deviceId: testDeviceId,
  action: "reduce",
  days: 1,
});
subTests.reduce = { status: reduce.status, data: reduce.body?.data };

// deactivate
const deactivate = await apiPost("/api/subscriptions", cookie, {
  deviceId: testDeviceId,
  action: "deactivate",
});
subTests.deactivate = { status: deactivate.status, data: deactivate.body?.data };

// re-activate
const reactivate = await apiPost("/api/subscriptions", cookie, {
  deviceId: testDeviceId,
  action: "activate",
  planId: "plan-daily",
});
subTests.reactivate = { status: reactivate.status, data: reactivate.body?.data };

// remove
const remove = await apiPost("/api/subscriptions", cookie, {
  deviceId: testDeviceId,
  action: "remove",
});
subTests.remove = { status: remove.status, data: remove.body?.data };

const afterRemove = await apiGet("/api/subscriptions", cookie);
subTests.stillExists = (afterRemove.body?.data ?? []).some((r) => r.deviceId === testDeviceId);

report.subscriptionTests = subTests;
report.checks.subscriptionManagement =
  activate.status === 200 &&
  extend.status === 200 &&
  reduce.status === 200 &&
  deactivate.status === 200 &&
  reactivate.status === 200 &&
  remove.status === 200 &&
  !subTests.stillExists;

// 7. Exact expiry timestamp (10 PM + 3 days)
console.log("7. Expiry timestamp precision");
const expiryDevice = `verify-expiry-${Date.now()}`;
const purchaseAt = new Date();
purchaseAt.setUTCHours(22, 0, 0, 0);
if (purchaseAt.getTime() < Date.now() - 86400000) purchaseAt.setUTCDate(purchaseAt.getUTCDate() + 1);

// Use Supabase direct insert to simulate purchase time via activate + check plan duration
// Admin activate uses now() - verify via compute: activate plan with 3 day extend
const expiryActivate = await apiPost("/api/subscriptions", cookie, {
  deviceId: expiryDevice,
  action: "activate",
  planId: "plan-daily",
});
await apiPost("/api/subscriptions", cookie, { deviceId: expiryDevice, action: "extend", days: 2 });
const expiryRow = (await apiGet("/api/subscriptions", cookie)).body?.data?.find(
  (r) => r.deviceId === expiryDevice
);
subTests.expiryRow = expiryRow;

// Check time-of-day preserved on extend from existing (within same minute tolerance)
const started = expiryRow?.startedAt ? new Date(expiryRow.startedAt) : null;
const expires = expiryRow?.expiresAt ? new Date(expiryRow.expiresAt) : null;
const timeOfDayMatch =
  started && expires
    ? started.getUTCHours() === expires.getUTCHours() &&
      started.getUTCMinutes() === expires.getUTCMinutes()
    : false;

report.expiryVerification = {
  deviceId: expiryDevice,
  startedAt: expiryRow?.startedAt,
  expiresAt: expiryRow?.expiresAt,
  timeOfDayPreserved: timeOfDayMatch,
  expectedPattern: "purchase time-of-day equals expiry time-of-day when stacking days",
};
report.checks.expiryTimestamp = Boolean(expiryRow?.expiresAt && timeOfDayMatch);

await apiPost("/api/subscriptions", cookie, { deviceId: expiryDevice, action: "remove" });

// 8. Schema probes
console.log("8. Schema probes");
const probes = {
  video_view_sessions: await restTable("video_view_sessions", "device_id", "&limit=1"),
  apk_is_current: await restTable("apk_releases", "id,version,is_current,download_count", "&limit=5"),
  device_subscriptions: await restTable("device_subscriptions", "device_id,expires_at", "&limit=3"),
  transactions: await restTable("transactions", "id,status,amount", "&limit=3"),
};
report.schemaProbes = {
  video_view_sessions: probes.video_view_sessions.error ?? "ok",
  apk_is_current: probes.apk_is_current.error ?? (probes.apk_is_current.data?.[0]?.is_current !== undefined ? "ok" : "missing is_current"),
  device_subscriptions: probes.device_subscriptions.error ?? "ok",
  transactions: probes.transactions.error ?? "ok",
};

// Zero investigation
report.zeroInvestigation = {
  dashboardAllZero: s.totalVideos === 0 && s.totalUsers === 0 && s.totalViews === 0,
  usersEmpty: (users.body?.data ?? []).length === 0,
  paymentsEmpty: (payments.body?.data ?? []).length === 0,
  analyticsViewsZero: allZeroDaily,
  analyticsRevenueZero: !hasNonZeroSeries(a.revenueChart, "revenue"),
  note:
    s.totalVideos === 0
      ? "No videos in DB"
      : s.totalUsers === 0
        ? "No device activity in transactions/view_sessions yet"
        : allZeroDaily && dbHasSessions
          ? "View sessions exist but not in last 30 day window"
          : null,
};

report.checks.overall =
  report.checks.dashboardStats &&
  report.checks.users &&
  report.checks.payments &&
  report.checks.analytics &&
  report.checks.apk &&
  report.checks.subscriptionManagement &&
  report.checks.expiryTimestamp;

console.log("\n=== FINAL REPORT ===");
console.log(JSON.stringify(report, null, 2));
process.exit(report.checks.overall ? 0 : 1);
