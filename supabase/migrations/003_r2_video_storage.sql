-- Cloudflare R2 video storage (idempotent — safe to re-run)
-- Run in Supabase Dashboard → SQL Editor if not applied via scripts/apply-r2-migration.mjs

ALTER TABLE videos ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS google_drive_url TEXT DEFAULT '';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS r2_object_key TEXT DEFAULT '';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS video_storage TEXT DEFAULT 'google_drive';

COMMENT ON COLUMN videos.video_url IS 'Public R2/CDN URL for direct HTML5 playback';
COMMENT ON COLUMN videos.google_drive_url IS 'Legacy Google Drive share link (migration fallback)';
COMMENT ON COLUMN videos.video_storage IS 'r2 | google_drive';
COMMENT ON COLUMN videos.r2_object_key IS 'R2 object key e.g. videos/1234-file.mp4';

UPDATE videos
SET video_storage = 'google_drive'
WHERE COALESCE(video_storage, '') = ''
  AND COALESCE(google_drive_url, '') <> ''
  AND COALESCE(video_url, '') = '';

UPDATE videos
SET video_storage = 'r2'
WHERE COALESCE(video_storage, '') = ''
  AND COALESCE(video_url, '') <> ''
  AND COALESCE(r2_object_key, '') <> '';

-- Refresh PostgREST schema cache (Supabase API)
NOTIFY pgrst, 'reload schema';
