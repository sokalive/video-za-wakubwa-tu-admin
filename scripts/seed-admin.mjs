/**
 * Seed or reset the production admin account only.
 * Usage: node scripts/seed-admin.mjs
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

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
    if (!process.env[key] || process.env[key] === '""' || process.env[key] === "''") process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("Run: vercel env pull .env.local --yes");
  process.exit(1);
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "waziriissa37@gmail.com").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Isamu2025";
const ADMIN_NAME = process.env.ADMIN_NAME || "Waziri Admin";

const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log("Checking admins table...");

  const { data: existing, error: listError } = await db
    .from("admins")
    .select("id, email, name, role, password_hash, created_at");

  if (listError) {
    console.error("Failed to query admins:", listError.message);
    process.exit(1);
  }

  console.log(`Found ${existing?.length ?? 0} admin(s)`);
  for (const admin of existing ?? []) {
    console.log(`  - ${admin.email} (${admin.role})`);
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const hashValid = await bcrypt.compare(ADMIN_PASSWORD, passwordHash);
  if (!hashValid) {
    console.error("bcrypt self-check failed");
    process.exit(1);
  }
  console.log("bcrypt hash generation verified");

  const target = existing?.find((a) => a.email.toLowerCase() === ADMIN_EMAIL);
  if (target) {
    const currentValid = await bcrypt.compare(ADMIN_PASSWORD, target.password_hash);
    if (currentValid) {
      console.log(`Admin already exists with matching password: ${ADMIN_EMAIL}`);
      return;
    }
    console.log(`Updating password for existing admin: ${ADMIN_EMAIL}`);
    const { error: updateError } = await db
      .from("admins")
      .update({ password_hash: passwordHash, name: ADMIN_NAME, role: "super_admin" })
      .eq("email", ADMIN_EMAIL);
    if (updateError) {
      console.error("Update failed:", updateError.message);
      process.exit(1);
    }
    console.log("Admin password updated");
    return;
  }

  console.log(`Creating admin: ${ADMIN_EMAIL}`);
  const { error: insertError } = await db.from("admins").upsert(
    {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      password_hash: passwordHash,
      role: "super_admin",
    },
    { onConflict: "email" }
  );

  if (insertError) {
    console.error("Insert failed:", insertError.message);
    process.exit(1);
  }

  const { data: created, error: verifyError } = await db
    .from("admins")
    .select("id, email, password_hash")
    .eq("email", ADMIN_EMAIL)
    .single();

  if (verifyError || !created) {
    console.error("Could not verify created admin:", verifyError?.message);
    process.exit(1);
  }

  const loginWorks = await bcrypt.compare(ADMIN_PASSWORD, created.password_hash);
  if (!loginWorks) {
    console.error("Post-insert bcrypt verification failed");
    process.exit(1);
  }

  console.log("Admin created and verified");
  console.log(`Email: ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
