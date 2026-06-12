-- Autoplay flag, deduplicated view tracking, and analytics RPC
-- Run in Supabase SQL Editor (shared with public site project)

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS autoplay BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS video_view_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_video_view_sessions_video ON video_view_sessions(video_id);
CREATE INDEX IF NOT EXISTS idx_video_view_sessions_last_viewed ON video_view_sessions(last_viewed_at);

ALTER TABLE video_view_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage view sessions" ON video_view_sessions;
CREATE POLICY "Service can manage view sessions"
  ON video_view_sessions FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION increment_video_views(
  video_id TEXT,
  device_id TEXT DEFAULT NULL,
  cooldown_minutes INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_viewed TIMESTAMPTZ;
  v_counted BOOLEAN := false;
BEGIN
  IF device_id IS NOT NULL AND length(trim(device_id)) > 0 THEN
    SELECT last_viewed_at INTO v_last_viewed
    FROM video_view_sessions
    WHERE video_view_sessions.video_id = increment_video_views.video_id
      AND video_view_sessions.device_id = increment_video_views.device_id;

    IF v_last_viewed IS NOT NULL
       AND v_last_viewed > NOW() - (cooldown_minutes || ' minutes')::INTERVAL THEN
      RETURN jsonb_build_object('counted', false, 'reason', 'cooldown');
    END IF;

    INSERT INTO video_view_sessions (video_id, device_id, last_viewed_at)
    VALUES (increment_video_views.video_id, increment_video_views.device_id, NOW())
    ON CONFLICT (video_id, device_id)
    DO UPDATE SET last_viewed_at = NOW();
  END IF;

  UPDATE videos
  SET views = views + 1
  WHERE id = increment_video_views.video_id AND published = true;

  IF FOUND THEN
    v_counted := true;
  END IF;

  RETURN jsonb_build_object('counted', v_counted);
END;
$$;

GRANT EXECUTE ON FUNCTION increment_video_views(TEXT, TEXT, INT) TO anon, authenticated;
