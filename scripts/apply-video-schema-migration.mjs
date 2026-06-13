/**
 * Apply migrations 010 + 011 via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRef = "ouknrrrgnqwdadfbxqwr";
const migrationFiles = [
  "010_video_pins.sql",
  "011_video_vip_trial_seconds.sql",
];

for (const envPath of [
  join(__dirname, "..", ".env.production.local"),
  join(__dirname, "..", ".env.local"),
]) {
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

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN (Supabase Dashboard → Account → Access Tokens)");
  process.exit(1);
}

async function runQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Query failed (${res.status}): ${text.slice(0, 400)}`);
  return text;
}

for (const file of migrationFiles) {
  const migrationSql = readFileSync(join(__dirname, "..", "supabase", "migrations", file), "utf8");
  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--") && !s.startsWith("NOTIFY"));

  console.log(`Applying ${file}...`);
  for (const statement of statements) {
    await runQuery(`${statement};`);
    console.log("OK:", statement.slice(0, 70).replace(/\s+/g, " "));
  }
}

await runQuery("NOTIFY pgrst, 'reload schema';");
console.log("Video schema migrations complete.");
