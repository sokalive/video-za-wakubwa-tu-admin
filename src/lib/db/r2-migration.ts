import { readFileSync } from "fs";
import { join } from "path";
import { supabaseRest } from "@/lib/db/rest";

export const R2_MIGRATION_FILE = "supabase/migrations/003_r2_video_storage.sql";

export function getR2MigrationSql(): string {
  try {
    return readFileSync(join(process.cwd(), R2_MIGRATION_FILE), "utf8");
  } catch {
    return `-- Fallback if file not bundled
ALTER TABLE videos ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS google_drive_url TEXT DEFAULT '';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS r2_object_key TEXT DEFAULT '';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS video_storage TEXT DEFAULT 'google_drive';
NOTIFY pgrst, 'reload schema';
`;
  }
}

export async function probeR2VideoColumns(): Promise<{
  ready: boolean;
  error: string | null;
}> {
  const { error, status } = await supabaseRest<unknown[]>(
    "videos?select=id,video_url,r2_object_key,video_storage&limit=0"
  );

  if (!error) {
    return { ready: true, error: null };
  }

  const message = error;
  const missingColumn =
    /r2_object_key|video_storage|schema cache/i.test(message) || status === 400;

  return {
    ready: false,
    error: missingColumn
      ? message
      : `Unexpected videos probe error (HTTP ${status}): ${message}`,
  };
}
