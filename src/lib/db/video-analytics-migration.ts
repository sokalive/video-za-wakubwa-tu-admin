import { readFileSync } from "fs";
import { join } from "path";
import { supabaseRest } from "@/lib/db/rest";

export const ANALYTICS_MIGRATION_FILE = "supabase/migrations/004_video_analytics_autoplay.sql";

export function getAnalyticsMigrationSql(): string {
  try {
    return readFileSync(join(process.cwd(), ANALYTICS_MIGRATION_FILE), "utf8");
  } catch {
    return `-- Fallback if file not bundled
ALTER TABLE videos ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS autoplay BOOLEAN NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION increment_video_likes(video_id TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE videos SET likes_count = likes_count + 1 WHERE id = video_id AND published = true; END; $$;
GRANT EXECUTE ON FUNCTION increment_video_likes(TEXT) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
`;
  }
}

export async function probeAnalyticsColumns(): Promise<{
  ready: boolean;
  error: string | null;
}> {
  const { error, status } = await supabaseRest<unknown[]>(
    "videos?select=id,likes_count,autoplay&limit=0"
  );

  if (!error) {
    return { ready: true, error: null };
  }

  const message = error;
  const missingColumn =
    /likes_count|autoplay|schema cache/i.test(message) || status === 400;

  return {
    ready: false,
    error: missingColumn
      ? message
      : `Unexpected videos probe error (HTTP ${status}): ${message}`,
  };
}
