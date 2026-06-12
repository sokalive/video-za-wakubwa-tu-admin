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
const deviceId = `verify-3day-${Date.now()}`;

const login = await fetch(`${admin}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
await login.json();
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const h = { "Content-Type": "application/json", Cookie: cookie };

const activate = await fetch(`${admin}/api/subscriptions`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({ deviceId, action: "activate", planId: "plan-daily" }),
});
const act = await activate.json();
const started = act.data?.expiresAt ? null : act.data;
const subs = await fetch(`${admin}/api/subscriptions`, { headers: { Cookie: cookie } }).then((r) => r.json());
const row = (subs.data ?? []).find((s) => s.deviceId === deviceId);
const start = new Date(row?.startedAt ?? act.data?.expiresAt);
const end = new Date(row?.expiresAt ?? act.data?.expiresAt);
const diffDays = Math.round((end - start) / 86400000);
await fetch(`${admin}/api/subscriptions`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({ deviceId, action: "remove" }),
});

console.log(
  JSON.stringify(
    {
      deviceId,
      startedAt: row?.startedAt,
      expiresAt: row?.expiresAt,
      diffDays,
      timeOfDayMatch:
        start.getUTCHours() === end.getUTCHours() && start.getUTCMinutes() === end.getUTCMinutes(),
      threeDayPlan: diffDays === 3,
    },
    null,
    2
  )
);
