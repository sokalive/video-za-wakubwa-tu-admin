-- Video deduplication metadata for admin uploads.
ALTER TABLE videos ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS source_file_name TEXT;

CREATE INDEX IF NOT EXISTS idx_videos_file_hash
  ON videos (file_hash)
  WHERE file_hash IS NOT NULL AND file_hash <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_r2_object_key_unique
  ON videos (r2_object_key)
  WHERE r2_object_key IS NOT NULL AND r2_object_key <> '';

CREATE INDEX IF NOT EXISTS idx_videos_file_size_name
  ON videos (file_size, source_file_name)
  WHERE file_size IS NOT NULL AND source_file_name IS NOT NULL AND source_file_name <> '';

NOTIFY pgrst, 'reload schema';
