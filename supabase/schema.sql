-- Video Za Wakubwa Tu - Shared Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ADMINS
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'admin', 'moderator')),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'grid',
  video_count INT NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VIDEOS
-- ============================================================
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  category_name TEXT DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  google_drive_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  r2_object_key TEXT DEFAULT '',
  video_storage TEXT DEFAULT 'google_drive',
  trailer_url TEXT,
  duration TEXT DEFAULT '0:00',
  resolution TEXT DEFAULT '1080p',
  is_vip BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  pin_order INT,
  autoplay BOOLEAN NOT NULL DEFAULT false,
  views INT NOT NULL DEFAULT 0,
  likes_count INT NOT NULL DEFAULT 0,
  trial_enabled BOOLEAN NOT NULL DEFAULT false,
  trial_duration_value INT NOT NULL DEFAULT 0,
  trial_duration_unit TEXT NOT NULL DEFAULT 'minutes',
  rating INT NOT NULL DEFAULT 75,
  channel TEXT DEFAULT 'VZW',
  tags TEXT[] DEFAULT '{}',
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category_id);
CREATE INDEX IF NOT EXISTS idx_videos_featured ON videos(is_featured);
CREATE INDEX IF NOT EXISTS idx_videos_pinned ON videos(is_pinned, pin_order);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(published);

-- ============================================================
-- VIP PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS vip_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'custom',
  price INT NOT NULL,
  duration_days INT NOT NULL,
  duration_value INT NOT NULL DEFAULT 1,
  duration_unit TEXT NOT NULL DEFAULT 'days',
  duration_label TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'TZS',
  features TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  popular BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- APK RELEASES
-- ============================================================
CREATE TABLE IF NOT EXISTS apk_releases (
  id TEXT PRIMARY KEY DEFAULT 'current',
  version TEXT NOT NULL,
  file_url TEXT NOT NULL DEFAULT '',
  file_size TEXT NOT NULL DEFAULT '',
  release_notes TEXT DEFAULT '',
  screenshots TEXT[] DEFAULT '{}',
  force_update BOOLEAN NOT NULL DEFAULT false,
  download_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  vip_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_spent INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  plan_id TEXT REFERENCES vip_plans(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  amount INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'failed', 'refunded')),
  method TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ADVERTISEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS advertisements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('banner', 'popup')),
  placement TEXT NOT NULL CHECK (placement IN ('homepage', 'video_page', 'both')),
  image_url TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SITE SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  website_name TEXT NOT NULL DEFAULT 'Video Za Wakubwa Tu',
  logo_url TEXT DEFAULT '',
  homepage_banner_url TEXT DEFAULT '',
  footer_text TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  social_links JSONB DEFAULT '[]'::jsonb,
  vip_trial_enabled BOOLEAN NOT NULL DEFAULT false,
  vip_trial_duration_value INT NOT NULL DEFAULT 5,
  vip_trial_duration_unit TEXT NOT NULL DEFAULT 'minutes',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  admin_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (public read, admin write via service role)
-- ============================================================
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE apk_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read videos" ON videos FOR SELECT USING (published = true);
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read vip_plans" ON vip_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Public read apk" ON apk_releases FOR SELECT USING (true);
CREATE POLICY "Public read settings" ON site_settings FOR SELECT USING (true);

-- Storage buckets (run in Supabase Dashboard > Storage):
-- Create bucket: media (public)
-- Folders: thumbnails/, apk/, screenshots/
-- NOTE: Video files are stored on Google Drive, NOT in Supabase Storage.
