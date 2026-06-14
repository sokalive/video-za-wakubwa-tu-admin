-- Ensure every video with a playback source is published on the public website.
UPDATE videos
SET published = true
WHERE published = false
  AND (
    COALESCE(video_url, '') <> ''
    OR COALESCE(google_drive_url, '') <> ''
  );

-- Re-sync category counts to published videos only.
UPDATE categories AS c
SET video_count = sub.cnt
FROM (
  SELECT category_id, COUNT(*)::INT AS cnt
  FROM videos
  WHERE published = true
    AND category_id IS NOT NULL
  GROUP BY category_id
) AS sub
WHERE c.id = sub.category_id;

UPDATE categories
SET video_count = 0
WHERE id NOT IN (
  SELECT DISTINCT category_id
  FROM videos
  WHERE published = true
    AND category_id IS NOT NULL
);
