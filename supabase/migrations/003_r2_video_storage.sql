-- Cloudflare R2 video storage (preserves legacy google_drive_url for migration)

ALTER TABLE videos ADD COLUMN IF NOT EXISTS video_storage TEXT DEFAULT 'google_drive';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS r2_object_key TEXT DEFAULT '';

COMMENT ON COLUMN videos.video_url IS 'Public R2/CDN URL for direct HTML5 playback';
COMMENT ON COLUMN videos.google_drive_url IS 'Legacy Google Drive share link (migration fallback)';
COMMENT ON COLUMN videos.video_storage IS 'r2 | google_drive';
COMMENT ON COLUMN videos.r2_object_key IS 'R2 object key e.g. videos/1234-file.mp4';

-- Existing rows with only google_drive_url stay on google_drive storage
UPDATE videos
SET video_storage = 'google_drive'
WHERE COALESCE(video_storage, '') = ''
  AND COALESCE(google_drive_url, '') <> ''
  AND COALESCE(video_url, '') = '';
