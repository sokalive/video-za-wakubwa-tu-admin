/**
 * Apply VIP plans + trial migration (007).
 * Usage: SUPABASE_DATABASE_URL="postgresql://..." node scripts/apply-vip-trial-migration.mjs
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFiles = [join(__dirname, "..", ".env.production.local"), join(__dirname, "..", ".env.local")];

for (const envPath of envFiles) {
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
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

const databaseUrl = buildSupabaseDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing SUPABASE_DATABASE_URL, DATABASE_URL, or SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const migrationPath = join(__dirname, "..", "supabase", "migrations", "007_vip_plans_and_trial.sql");
const migrationSql = readFileSync(migrationPath, "utf8");
const statements = migrationSql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

try {
  console.log("Applying VIP plans + trial migration...");
  for (const statement of statements) {
    await sql.unsafe(`${statement};`);
  }
  console.log("Done.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
