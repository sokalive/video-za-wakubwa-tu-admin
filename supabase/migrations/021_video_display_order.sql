-- Canonical manual video ordering for admin + public website.
ALTER TABLE videos ADD COLUMN IF NOT EXISTS display_order INT;

-- Backfill: pinned videos first (pin_order), then newest unpinned — matches prior admin list.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN COALESCE(is_pinned, false) THEN 0 ELSE 1 END,
        CASE WHEN COALESCE(is_pinned, false) THEN COALESCE(pin_order, 999999) ELSE 999999 END,
        created_at DESC,
        id ASC
    ) AS rn
  FROM videos
)
UPDATE videos v
SET display_order = ranked.rn
FROM ranked
WHERE v.id = ranked.id AND v.display_order IS NULL;

UPDATE videos SET display_order = 999999 WHERE display_order IS NULL;

CREATE INDEX IF NOT EXISTS idx_videos_display_order ON videos (display_order ASC, created_at ASC, id ASC);

NOTIFY pgrst, 'reload schema';
