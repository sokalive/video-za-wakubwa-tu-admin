-- Homepage pinned videos (admin controls order via pin_order).
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS pin_order INT;

COMMENT ON COLUMN videos.is_pinned IS 'When true, video is shown first on the public homepage.';
COMMENT ON COLUMN videos.pin_order IS 'Lower numbers appear first among pinned homepage videos.';

CREATE INDEX IF NOT EXISTS idx_videos_homepage_pins
  ON videos (pin_order ASC, created_at DESC)
  WHERE is_pinned = true AND published = true;
