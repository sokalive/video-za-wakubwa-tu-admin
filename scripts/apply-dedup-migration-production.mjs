/**
 * Apply migration 017 (video dedup metadata) on production and verify schema.
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const adminUrl = (process.env.ADMIN_URL || "https://video-za-wakubwa-tu-admin.vercel.app").replace(/\/$/, "");
const projectRef = "ouknrrrgnqwdadfbxqwr";

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
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${projectRef}.supabase.co`;
  if (!dbPassword) return null;
  try {
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    const region = process.env.SUPABASE_DB_REGION || "ap-southeast-1";
    return `postgresql://postgres.${ref}:${encodeURIComponent(dbPassword)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
  } catch {
    return null;
  }
}

function migrationStatements() {
  const migrationPath = join(__dirname, "..", "supabase", "migrations", "017_video_dedup_metadata.sql");
  return readFileSync(migrationPath, "utf8")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--") && !s.startsWith("NOTIFY"));
}

async function applyViaManagementApi() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return { ok: false, reason: "no SUPABASE_ACCESS_TOKEN" };

  for (const statement of migrationStatements()) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: `${statement};` }),
    });
    if (!res.ok) {
      return { ok: false, reason: `Management API (${res.status}): ${(await res.text()).slice(0, 300)}` };
    }
  }
  await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "NOTIFY pgrst, 'reload schema';" }),
  });
  return { ok: true, method: "management-api" };
}

async function applyViaPostgres() {
  const databaseUrl = buildSupabaseDatabaseUrl();
  if (!databaseUrl) return { ok: false, reason: "no database URL" };

  const sql = postgres(databaseUrl, { ssl: "require", max: 1, connect_timeout: 20 });
  try {
    for (const statement of migrationStatements()) {
      await sql.unsafe(`${statement};`);
    }
    await sql.unsafe("NOTIFY pgrst, 'reload schema';");
    return { ok: true, method: "postgres-pooler" };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function applyViaAdminApi(cookie) {
  const headers = { Cookie: cookie, "Content-Type": "application/json" };
  if (process.env.JWT_SECRET) headers["x-setup-token"] = process.env.JWT_SECRET;

  const res = await fetch(`${adminUrl}/api/setup/migrate-video-schema`, { method: "POST", headers });
  const data = await res.json();
  if (res.ok && data.dedupColumnsReady) return { ok: true, method: "admin-migrate-api", data };
  if (res.status === 503) return { ok: false, reason: "admin API: SUPABASE_DATABASE_URL not set on Vercel" };
  return { ok: false, reason: data.error || data.message || `HTTP ${res.status}` };
}

async function probeSchema() {
  const res = await fetch(`${adminUrl}/api/setup/migrate-video-schema`);
  return res.json();
}

async function verifyColumnsViaPostgres() {
  const databaseUrl = buildSupabaseDatabaseUrl();
  if (!databaseUrl) return null;

  const sql = postgres(databaseUrl, { ssl: "require", max: 1, connect_timeout: 20 });
  try {
    const cols = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'videos'
        AND column_name IN ('file_hash', 'file_size', 'source_file_name')
      ORDER BY column_name
    `;
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'videos'
        AND indexname IN ('idx_videos_file_hash', 'idx_videos_r2_object_key_unique', 'idx_videos_file_size_name')
      ORDER BY indexname
    `;
    return { columns: cols, indexes };
  } catch {
    return null;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  console.log("=== Before migration ===");
  const before = await probeSchema();
  console.log(JSON.stringify(before, null, 2));

  if (!before.dedupColumnsReady) {
    console.log("\n=== Applying migration 017 ===");
    let applied = await applyViaManagementApi();
    if (!applied.ok) {
      console.log("Management API:", applied.reason);
      applied = await applyViaPostgres();
    }
    if (!applied.ok) {
      console.log("Postgres pooler:", applied.reason);
      try {
        const cookie = await login();
        applied = await applyViaAdminApi(cookie);
      } catch (err) {
        applied = { ok: false, reason: err instanceof Error ? err.message : String(err) };
      }
    }
    if (!applied.ok) {
      console.error("\nMigration failed via all channels:", applied.reason);
      console.log("\nRun manually in Supabase SQL Editor:\n");
      console.log(readFileSync(join(__dirname, "..", "supabase", "migrations", "017_video_dedup_metadata.sql"), "utf8"));
      process.exit(1);
    }
    console.log("Applied via:", applied.method);
  } else {
    console.log("Migration already applied.");
  }

  console.log("\n=== After migration (API probe) ===");
  const after = await probeSchema();
  console.log(JSON.stringify(after, null, 2));

  const dbVerify = await verifyColumnsViaPostgres();
  if (dbVerify) {
    console.log("\n=== Direct DB verification ===");
    console.log(JSON.stringify(dbVerify, null, 2));
  }

  if (!after.dedupColumnsReady) {
    process.exit(1);
  }
  console.log("\nMigration 017 verified: dedupColumnsReady=true");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
