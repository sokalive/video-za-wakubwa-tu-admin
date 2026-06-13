import { readFileSync } from "fs";
import { join } from "path";
import { supabaseRest } from "@/lib/db/rest";

export const VIDEO_PINS_MIGRATION_FILE = "supabase/migrations/010_video_pins.sql";

export function getVideoPinsMigrationSql(): string {
  try {
    return readFileSync(join(process.cwd(), VIDEO_PINS_MIGRATION_FILE), "utf8");
  } catch {
    return `-- See supabase/migrations/010_video_pins.sql`;
  }
}

export async function probeVideoPinColumns(): Promise<{ ready: boolean; error: string | null }> {
  const probe = await supabaseRest<unknown[]>("videos?select=id,is_pinned,pin_order&limit=0");
  if (probe.error) {
    return {
      ready: false,
      error: /is_pinned|pin_order|schema cache/i.test(probe.error) ? probe.error : probe.error,
    };
  }
  return { ready: true, error: null };
}
