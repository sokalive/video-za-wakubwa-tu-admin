import { readFileSync } from "fs";
import { join } from "path";
import { getVideoOptionalColumns } from "@/lib/db/video-schema";

export const VIDEO_SCHEMA_MIGRATION_FILES = [
  "supabase/migrations/010_video_pins.sql",
  "supabase/migrations/011_video_vip_trial_seconds.sql",
  "supabase/migrations/017_video_dedup_metadata.sql",
] as const;

export const VIDEO_DEDUP_MIGRATION_FILE = "supabase/migrations/017_video_dedup_metadata.sql";

export function getVideoSchemaMigrationSql(): string {
  return VIDEO_SCHEMA_MIGRATION_FILES.map((file) => {
    try {
      return readFileSync(join(process.cwd(), file), "utf8");
    } catch {
      return `-- See ${file}`;
    }
  }).join("\n\n");
}

export function getVideoDedupMigrationSql(): string {
  try {
    return readFileSync(join(process.cwd(), VIDEO_DEDUP_MIGRATION_FILE), "utf8");
  } catch {
    return `-- See ${VIDEO_DEDUP_MIGRATION_FILE}`;
  }
}

export async function probeVideoSchemaColumns(): Promise<{
  ready: boolean;
  vipTrialSecondsReady: boolean;
  pinColumnsReady: boolean;
  dedupColumnsReady: boolean;
  error: string | null;
}> {
  const cols = await getVideoOptionalColumns(true);
  const ready = cols.vipTrialSeconds && cols.pinColumns && cols.dedupColumns;
  return {
    ready,
    vipTrialSecondsReady: cols.vipTrialSeconds,
    pinColumnsReady: cols.pinColumns,
    dedupColumnsReady: cols.dedupColumns,
    error: ready
      ? null
      : [
          !cols.vipTrialSeconds ? "videos.vip_trial_seconds missing" : null,
          !cols.pinColumns ? "videos.is_pinned/pin_order missing" : null,
          !cols.dedupColumns ? "videos.file_hash/file_size/source_file_name missing" : null,
        ]
          .filter(Boolean)
          .join("; "),
  };
}
