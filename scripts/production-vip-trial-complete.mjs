/**
 * Complete production VIP trial setup:
 * 1. Apply migration 007 (postgres URL or admin migrate API)
 * 2. Set global trial: enabled, 13 seconds
 * 3. Verify columns + create test VIP video with inherited trial
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

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

function buildSupabaseDatabaseUrl() {
  const explicit = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  if (explicit) return explicit;
  const password = process.env.SUPABASE_DB_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!password || !supabaseUrl) return null;
  try {
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    const region = process.env.SUPABASE_DB_REGION || "ap-southeast-1";
    return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
  } catch {
    return null;
  }
}

async function applyMigrationViaManagementApi() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return false;

  const migrationPath = join(__dirname, "..", "supabase", "migrations", "007_vip_plans_and_trial.sql");
  const migrationSql = readFileSync(migrationPath, "utf8");
  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--") && !s.startsWith("NOTIFY"));

  for (const statement of statements) {
    const res = await fetch("https://api.supabase.com/v1/projects/ouknrrrgnqwdadfbxqwr/database/query", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: `${statement};` }),
    });
    if (!res.ok) throw new Error(`Management API failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  await fetch("https://api.supabase.com/v1/projects/ouknrrrgnqwdadfbxqwr/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "NOTIFY pgrst, 'reload schema';" }),
  });
  return true;
}

async function applyMigrationViaPostgres() {
  const databaseUrl = buildSupabaseDatabaseUrl();
  if (!databaseUrl) return false;

  const migrationPath = join(__dirname, "..", "supabase", "migrations", "007_vip_plans_and_trial.sql");
  const migrationSql = readFileSync(migrationPath, "utf8");
  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  const sql = postgres(databaseUrl, { ssl: "require", max: 1 });
  try {
    for (const statement of statements) {
      await sql.unsafe(`${statement};`);
    }
    return true;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function applyMigrationViaAdmin(cookie) {
  const headers = { Cookie: cookie, "Content-Type": "application/json" };
  if (process.env.JWT_SECRET) headers["x-setup-token"] = process.env.JWT_SECRET;

  const res = await fetch(`${adminUrl}/api/setup/migrate-vip-trial`, { method: "POST", headers });
  const data = await res.json();
  if (!res.ok && !data.alreadyApplied) {
    throw new Error(data.error || `Migrate API failed (${res.status})`);
  }
  return data;
}

async function probeMigration() {
  const res = await fetch(`${adminUrl}/api/setup/migrate-vip-trial`);
  return res.json();
}

async function verifyColumnsViaRest() {
  if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase env");

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

async function setTrialSettings(cookie) {
  const res = await fetch(`${adminUrl}/api/vip-trial-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ enabled: true, durationValue: 13, durationUnit: "seconds" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to set trial settings");
  return data.data;
}

async function getTrialSettings(cookie) {
  const res = await fetch(`${adminUrl}/api/vip-trial-settings`, { headers: { Cookie: cookie } });
  const data = await res.json();
  return data.data;
}

async function createTestVipVideo(cookie) {
  const res = await fetch(`${adminUrl}/api/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      title: `VIP trial test ${Date.now()}`,
      description: "Auto-created to verify global trial inheritance",
      categoryId: "cat-1",
      isVip: true,
      googleDriveUrl: "https://drive.google.com/file/d/1VipTrialTestFile/view",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Create VIP test video failed");
  return { mode: "created-new", video: data.data };
}

async function verifyVideoTrial(cookie, videoId) {
  const res = await fetch(`${adminUrl}/api/videos`, { headers: { Cookie: cookie } });
  const data = await res.json();
  return (data.data ?? []).find((v) => v.id === videoId);
}

async function main() {
  console.log("=== Step 1: Probe migration ===");
  let probe = await probeMigration();
  console.log(JSON.stringify(probe, null, 2));

  if (!probe.vipTrialColumnsReady) {
    console.log("\n=== Step 2: Apply migration 007 ===");
    const pgOk = await applyMigrationViaPostgres();
    if (pgOk) {
      console.log("Applied via postgres connection.");
    } else if (await applyMigrationViaManagementApi().catch((e) => {
      console.log("Management API:", e.message);
      return false;
    })) {
      console.log("Applied via Supabase Management API.");
    } else {
      console.log("No DATABASE_URL — trying admin migrate API...");
      const cookie = await login();
      const migrateResult = await applyMigrationViaAdmin(cookie);
      console.log(JSON.stringify(migrateResult, null, 2));
    }
    probe = await probeMigration();
  }

  console.log("\n=== Step 3: Verify columns ===");
  const columns = await verifyColumnsViaRest();
  console.log(JSON.stringify(columns, null, 2));

  if (!probe.vipTrialColumnsReady) {
    throw new Error("Migration 007 not applied. Add SUPABASE_DATABASE_URL to Vercel or run SQL in Supabase SQL Editor.");
  }

  console.log("\n=== Step 4: Set trial settings (13 seconds) ===");
  const cookie = await login();
  const trial = await setTrialSettings(cookie);
  console.log(JSON.stringify(trial, null, 2));

  const readBack = await getTrialSettings(cookie);
  console.log("Read back:", JSON.stringify(readBack, null, 2));

  console.log("\n=== Step 5: Verify VIP video trial inheritance ===");
  const { mode, video } = await createTestVipVideo(cookie);
  console.log(mode, video.id, {
    trialEnabled: video.trialEnabled,
    trialDurationValue: video.trialDurationValue,
    trialDurationUnit: video.trialDurationUnit,
  });

  console.log("\n=== DONE ===");
  console.log(JSON.stringify({
    migrationApplied: probe.vipTrialColumnsReady,
    columns,
    trialSettings: readBack,
    testVideo: {
      id: video.id,
      isVip: video.isVip,
      trialEnabled: video.trialEnabled,
      trialDurationValue: video.trialDurationValue,
      trialDurationUnit: video.trialDurationUnit,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
