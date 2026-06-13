-- Pinned / featured video ordering for admin and website homepage

ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS pin_order INT;

CREATE INDEX IF NOT EXISTS idx_videos_pinned ON videos(is_pinned, pin_order);

NOTIFY pgrst, 'reload schema';
