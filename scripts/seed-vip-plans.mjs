/**
 * Seed default VIP plans (1 Day, 1 Week, 1 Month).
 *
 * Usage:
 *   node scripts/seed-vip-plans.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * (loads .env.local if present).
 */
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
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const plans = [
  {
    id: "plan-daily",
    name: "1 Day",
    type: "daily",
    price: 2000,
    duration_days: 1,
    duration_label: "1 Day",
    currency: "TZS",
    features: ["Access all VIP videos", "HD quality", "No ads"],
    is_active: true,
    popular: false,
  },
  {
    id: "plan-weekly",
    name: "1 Week",
    type: "weekly",
    price: 8000,
    duration_days: 7,
    duration_label: "1 Week",
    currency: "TZS",
    features: ["Access all VIP videos", "Full HD quality", "No ads", "Priority support"],
    is_active: true,
    popular: true,
  },
  {
    id: "plan-monthly",
    name: "1 Month",
    type: "monthly",
    price: 20000,
    duration_days: 30,
    duration_label: "1 Month",
    currency: "TZS",
    features: ["Access all VIP videos", "Best quality", "No ads", "Unlimited downloads", "VIP badge"],
    is_active: true,
    popular: false,
  },
];

async function seedVipPlans() {
  console.log("Seeding VIP plans...");
  for (const plan of plans) {
    const res = await fetch(`${url}/rest/v1/vip_plans`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(plan),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed ${plan.id}:`, text);
      process.exit(1);
    }
    console.log("Upserted:", plan.id, plan.name);
  }
  console.log("Done. 3 active VIP plans ready.");
}

seedVipPlans().catch((err) => {
  console.error(err);
  process.exit(1);
});
