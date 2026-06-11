-- Supabase Storage setup for Video Za Wakubwa Tu
-- Run in Supabase SQL Editor AFTER schema.sql

-- Create public media bucket (thumbnails, APK, screenshots)
-- Videos are NOT stored here — they use Google Drive links in the database.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  524288000,  -- 500 MB max per file (APK uploads)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/vnd.android.package-archive']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access to all files in media bucket
CREATE POLICY "Public read media files"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

-- Service role (admin API) bypasses RLS for uploads — no insert policy needed for admin.
-- If you ever use anon key for uploads, add authenticated insert policies here.
