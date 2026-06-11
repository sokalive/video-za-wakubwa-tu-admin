-- Migration: Add Google Drive URL column for video storage
-- Videos are hosted on Google Drive; only links are stored in the database.

ALTER TABLE videos ADD COLUMN IF NOT EXISTS google_drive_url TEXT DEFAULT '';

-- Migrate existing video_url values if any
UPDATE videos SET google_drive_url = video_url WHERE google_drive_url = '' AND video_url != '';

COMMENT ON COLUMN videos.google_drive_url IS 'Google Drive share link for video playback';
COMMENT ON COLUMN videos.video_url IS 'Deprecated — use google_drive_url instead';
