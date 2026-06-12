import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const admin = "https://video-za-wakubwa-tu-admin.vercel.app";

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

async function login() {
  const r = await fetch(`${admin}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  await r.json();
  const h = r.headers.getSetCookie?.() ?? r.headers.get("set-cookie");
  return (Array.isArray(h) ? h : [h]).map((c) => c.split(";")[0]).join("; ");
}

const cookie = await login();
const h = { Cookie: cookie };

const [payments, txns, apk, apkHist, plans, analytics, stats, users] = await Promise.all([
  fetch(`${admin}/api/payments`, { headers: h }).then((r) => r.json()),
  fetch(`${admin}/api/transactions`, { headers: h }).then((r) => r.json()),
  fetch(`${admin}/api/apk`, { headers: h }).then((r) => r.json()),
  fetch(`${admin}/api/apk?history=1`, { headers: h }).then((r) => r.json()),
  fetch(`${admin}/api/vip-plans`, { headers: h }).then((r) => r.json()),
  fetch(`${admin}/api/analytics`, { headers: h }).then((r) => r.json()),
  fetch(`${admin}/api/dashboard/stats`, { headers: h }).then((r) => r.json()),
  fetch(`${admin}/api/users`, { headers: h }).then((r) => r.json()),
]);

const dbRev = (txns.data ?? [])
  .filter((t) => t.status === "completed")
  .reduce((s, t) => s + (t.amount || 0), 0);

console.log(
  JSON.stringify(
    {
      revenue: {
        paymentsApi: payments.stats?.totalRevenue,
        transactionsEndpoint: dbRev,
        match: payments.stats?.totalRevenue === dbRev,
      },
      payments: payments.stats,
      transactionSample: (txns.data ?? []).slice(0, 5),
      users: users.stats,
      dashboard: stats.data,
      apk: { current: apk.data, historyCount: (apkHist.data ?? []).length, history: apkHist.data },
      plans: (plans.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        durationValue: p.durationValue,
        durationUnit: p.durationUnit,
        durationDays: p.durationDays,
      })),
      analytics: {
        dailyNonZero: (analytics.data?.dailyViews ?? []).filter((d) => d.views > 0),
        revenueNonZero: (analytics.data?.revenueChart ?? []).filter((d) => d.revenue > 0),
        subscriptionGrowthJun: (analytics.data?.subscriptionGrowth ?? []).find((m) => m.month === "Jun"),
      },
    },
    null,
    2
  )
);
