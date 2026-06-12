-- Video analytics & autoplay (idempotent — safe to re-run)
-- Run in Supabase Dashboard → SQL Editor if not applied via scripts/apply-analytics-migration.mjs

ALTER TABLE videos ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS autoplay BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN videos.likes_count IS 'Total likes from the public website';
COMMENT ON COLUMN videos.autoplay IS 'When true, video auto-starts on the watch page';

CREATE OR REPLACE FUNCTION increment_video_likes(video_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE videos
  SET likes_count = likes_count + 1
  WHERE id = video_id AND published = true;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_video_likes(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
