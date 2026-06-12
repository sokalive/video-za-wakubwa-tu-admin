-- Player features: likes, reports, optional multi-quality metadata
-- Run in Supabase SQL Editor (shared with admin project)

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS video_qualities JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS video_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_video_likes_video ON video_likes(video_id);

CREATE TABLE IF NOT EXISTS video_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT DEFAULT '',
  device_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_reports_video ON video_reports(video_id);
CREATE INDEX IF NOT EXISTS idx_video_reports_status ON video_reports(status);

ALTER TABLE video_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read likes" ON video_likes;
CREATE POLICY "Public can read likes"
  ON video_likes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can insert likes" ON video_likes;
CREATE POLICY "Public can insert likes"
  ON video_likes FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can delete likes" ON video_likes;
CREATE POLICY "Public can delete likes"
  ON video_likes FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can insert reports" ON video_reports;
CREATE POLICY "Public can insert reports"
  ON video_reports FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION sync_video_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE videos SET likes_count = likes_count + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE videos SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_video_likes_count ON video_likes;
CREATE TRIGGER trg_sync_video_likes_count
  AFTER INSERT OR DELETE ON video_likes
  FOR EACH ROW EXECUTE FUNCTION sync_video_likes_count();
