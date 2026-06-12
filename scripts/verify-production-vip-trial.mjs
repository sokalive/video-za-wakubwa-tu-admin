/**
 * Post-migration production verification for VIP trial system.
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const adminUrl = (process.env.ADMIN_URL || "https://video-za-wakubwa-tu-admin.vercel.app").replace(/\/$/, "");

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
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return "";
  const parts = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return parts.map((c) => c.split(";")[0]).join("; ");
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

async function verifyColumnsViaRest() {
  const checks = [
    { table: "vip_plans", cols: "id,duration_value,duration_unit" },
    { table: "site_settings", cols: "id,vip_trial_enabled,vip_trial_duration_value,vip_trial_duration_unit" },
    { table: "videos", cols: "id,trial_enabled,trial_duration_value,trial_duration_unit" },
  ];
  const results = {};
  for (const { table, cols } of checks) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${cols}&limit=0`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    results[table] = res.ok ? "OK" : (await res.text()).slice(0, 200);
  }
  return results;
}

const report = {};

console.log("=== 1. Migration probe ===");
const probeRes = await fetch(`${adminUrl}/api/setup/migrate-vip-trial`);
report.migrationProbe = await probeRes.json();

console.log("=== 2. Column verification ===");
report.columns = await verifyColumnsViaRest();

const cookie = await login();
console.log("Logged in as admin.");

console.log("=== 3. Set global trial: 13 seconds ===");
const putRes = await fetch(`${adminUrl}/api/vip-trial-settings`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({ enabled: true, durationValue: 13, durationUnit: "seconds" }),
});
const putData = await putRes.json();
if (!putRes.ok) throw new Error(putData.error || "PUT trial settings failed");
report.trialSettingsPut = putData.data;

console.log("=== 4. Read back trial settings (VIP Trial Settings page API) ===");
const getRes = await fetch(`${adminUrl}/api/vip-trial-settings`, { headers: { Cookie: cookie } });
const getData = await getRes.json();
if (!getRes.ok) throw new Error(getData.error || "GET trial settings failed");
report.trialSettingsGet = getData.data;

console.log("=== 5. Create new VIP video (inherit global trial) ===");
const catsRes = await fetch(`${adminUrl}/api/categories`, { headers: { Cookie: cookie } });
const catsData = await catsRes.json();
const categoryId = catsData.data?.[0]?.id;
if (!categoryId) throw new Error("No categories found on production");

const createRes = await fetch(`${adminUrl}/api/videos`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    title: `VIP trial inherit test ${Date.now()}`,
    description: "Verifies global 13s trial inheritance",
    categoryId,
    isVip: true,
    googleDriveUrl: "https://drive.google.com/file/d/1VipTrialInheritTest/view",
  }),
});
const createData = await createRes.json();
if (!createRes.ok) throw new Error(createData.error || "Create video failed");
report.newVipVideo = {
  id: createData.data.id,
  isVip: createData.data.isVip,
  trialEnabled: createData.data.trialEnabled,
  trialDurationValue: createData.data.trialDurationValue,
  trialDurationUnit: createData.data.trialDurationUnit,
};

console.log("=== 6. Override trial on existing VIP video ===");
const listRes = await fetch(`${adminUrl}/api/videos`, { headers: { Cookie: cookie } });
const listData = await listRes.json();
const existingVip = (listData.data ?? []).find((v) => v.isVip && v.id !== createData.data.id);
if (!existingVip) throw new Error("No existing VIP video found for override test");

const overrideRes = await fetch(`${adminUrl}/api/videos/${encodeURIComponent(existingVip.id)}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    trialEnabled: true,
    trialDurationValue: 30,
    trialDurationUnit: "seconds",
  }),
});
const overrideData = await overrideRes.json();
if (!overrideRes.ok) throw new Error(overrideData.error || "Override update failed");
report.existingVipOverride = {
  id: overrideData.data.id,
  title: overrideData.data.title,
  trialEnabled: overrideData.data.trialEnabled,
  trialDurationValue: overrideData.data.trialDurationValue,
  trialDurationUnit: overrideData.data.trialDurationUnit,
};

report.checks = {
  vipTrialColumnsReady: report.migrationProbe.vipTrialColumnsReady === true,
  allColumnsOk: Object.values(report.columns).every((v) => v === "OK"),
  trialEnabled13s:
    report.trialSettingsGet?.enabled === true &&
    report.trialSettingsGet?.durationValue === 13 &&
    report.trialSettingsGet?.durationUnit === "seconds",
  newVideoInheritsGlobal:
    report.newVipVideo.trialEnabled === true &&
    report.newVipVideo.trialDurationValue === 13 &&
    report.newVipVideo.trialDurationUnit === "seconds",
  existingVideoOverride:
    report.existingVipOverride.trialEnabled === true &&
    report.existingVipOverride.trialDurationValue === 30 &&
    report.existingVipOverride.trialDurationUnit === "seconds",
};

report.allPassed = Object.values(report.checks).every(Boolean);

console.log("\n=== FINAL REPORT ===");
console.log(JSON.stringify(report, null, 2));
process.exit(report.allPassed ? 0 : 1);
