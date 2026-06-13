import { readFileSync } from "fs";
import { join } from "path";
import { getVideoOptionalColumns } from "@/lib/db/video-schema";

export const VIDEO_SCHEMA_MIGRATION_FILES = [
  "supabase/migrations/010_video_pins.sql",
  "supabase/migrations/011_video_vip_trial_seconds.sql",
] as const;

export function getVideoSchemaMigrationSql(): string {
  return VIDEO_SCHEMA_MIGRATION_FILES.map((file) => {
    try {
      return readFileSync(join(process.cwd(), file), "utf8");
    } catch {
      return `-- See ${file}`;
    }
  }).join("\n\n");
}

export async function probeVideoSchemaColumns(): Promise<{
  ready: boolean;
  vipTrialSecondsReady: boolean;
  pinColumnsReady: boolean;
  error: string | null;
}> {
  const cols = await getVideoOptionalColumns(true);
  const ready = cols.vipTrialSeconds && cols.pinColumns;
  return {
    ready,
    vipTrialSecondsReady: cols.vipTrialSeconds,
    pinColumnsReady: cols.pinColumns,
    error: ready
      ? null
      : [
          !cols.vipTrialSeconds ? "videos.vip_trial_seconds missing" : null,
          !cols.pinColumns ? "videos.is_pinned/pin_order missing" : null,
        ]
          .filter(Boolean)
          .join("; "),
  };
}
