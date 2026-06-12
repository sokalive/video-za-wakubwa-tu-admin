/**
 * Apply video analytics & autoplay migration to Supabase Postgres.
 *
 * Usage:
 *   SUPABASE_DATABASE_URL="postgresql://..." node scripts/apply-analytics-migration.mjs
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing SUPABASE_DATABASE_URL or DATABASE_URL");
  process.exit(1);
}

const migrationPath = join(__dirname, "..", "supabase", "migrations", "004_video_analytics_autoplay.sql");
const migrationSql = readFileSync(migrationPath, "utf8");

const statements = migrationSql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

try {
  console.log("Applying analytics & autoplay migration...");
  for (const statement of statements) {
    await sql.unsafe(`${statement};`);
  }
  console.log("Done. Columns: likes_count, autoplay; function: increment_video_likes");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
