/**
 * Full upload audit via production API (uses Vercel credentials).
 * Usage: node scripts/upload-audit-production.mjs [--repair]
 */
const repair = process.argv.includes("--repair");
const ADMIN_URL = (process.env.ADMIN_URL || "https://video-za-wakubwa-tu-admin.vercel.app").replace(/\/$/, "");

async function main() {
  const auditRes = await fetch(`${ADMIN_URL}/api/setup/upload-audit`);
  const auditJson = await auditRes.json();
  if (!auditRes.ok) {
    console.error("Audit failed:", auditJson);
    process.exit(1);
  }
  console.log(JSON.stringify(auditJson.audit ?? auditJson, null, 2));

  if (!repair) return;

  const repairRes = await fetch(`${ADMIN_URL}/api/setup/upload-audit`, { method: "POST" });
  const repairJson = await repairRes.json();
  if (!repairRes.ok) {
    console.error("Repair failed:", repairJson);
    process.exit(1);
  }
  console.log("\nRepair result:", JSON.stringify(repairJson, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
