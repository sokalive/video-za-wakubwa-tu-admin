/**
 * Probe production (or local) video schema including dedup columns.
 * Usage: node scripts/verify-video-schema-probe.mjs [baseUrl]
 */
const base = process.argv[2] || "https://video-za-wakubwa-tu-admin.vercel.app";

async function main() {
  const res = await fetch(`${base}/api/setup/migrate-video-schema`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  if (!data.dedupColumnsReady) {
    console.log("\n--- Run this SQL in Supabase if dedup columns are missing ---\n");
    console.log(data.dedupMigrationSql || data.sql || "See supabase/migrations/017_video_dedup_metadata.sql");
    process.exit(1);
  }

  console.log("\nAll video schema columns ready (including dedup metadata).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
