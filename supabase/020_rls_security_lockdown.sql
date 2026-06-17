-- 020_rls_security_lockdown.sql
-- Fix Supabase linter: rls_disabled_in_public, sensitive_columns_exposed
-- Run in Supabase SQL Editor (project: ouknrrrgnqwdadfbxqwr)
-- Idempotent. Website public reads unchanged; admin/service-role unchanged.

BEGIN;

ALTER TABLE IF EXISTS public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vip_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.apk_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.advertisements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.site_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sonicpesa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.checkout_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.device_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.video_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.video_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.video_view_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read videos" ON public.videos;
CREATE POLICY "Public read videos"
  ON public.videos FOR SELECT TO anon, authenticated USING (published = true);

DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories"
  ON public.categories FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read vip_plans" ON public.vip_plans;
CREATE POLICY "Public read vip_plans"
  ON public.vip_plans FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public read apk" ON public.apk_releases;
CREATE POLICY "Public read apk"
  ON public.apk_releases FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read settings" ON public.site_settings;
CREATE POLICY "Public read settings"
  ON public.site_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read likes" ON public.video_likes;
CREATE POLICY "Public can read likes"
  ON public.video_likes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can insert likes" ON public.video_likes;
CREATE POLICY "Public can insert likes"
  ON public.video_likes FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can delete likes" ON public.video_likes;
CREATE POLICY "Public can delete likes"
  ON public.video_likes FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can insert reports" ON public.video_reports;
CREATE POLICY "Public can insert reports"
  ON public.video_reports FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert payments" ON public.payments;
DROP POLICY IF EXISTS "Public update payments" ON public.payments;
DROP POLICY IF EXISTS "Public select payments" ON public.payments;
DROP POLICY IF EXISTS "Service role all users" ON public.users;
DROP POLICY IF EXISTS "Public insert users" ON public.users;
DROP POLICY IF EXISTS "Public update users" ON public.users;
DROP POLICY IF EXISTS "Public select users" ON public.users;
DROP POLICY IF EXISTS "Public insert site_devices" ON public.site_devices;
DROP POLICY IF EXISTS "Public update site_devices" ON public.site_devices;
DROP POLICY IF EXISTS "Public select site_devices" ON public.site_devices;
DROP POLICY IF EXISTS "Public insert analytics_events" ON public.analytics_events;
DROP POLICY IF EXISTS "Public select analytics_events" ON public.analytics_events;
DROP POLICY IF EXISTS "Public update analytics_events" ON public.analytics_events;
DROP POLICY IF EXISTS "Service can manage view sessions" ON public.video_view_sessions;

REVOKE ALL ON TABLE public.admins FROM anon, authenticated;
REVOKE ALL ON TABLE public.advertisements FROM anon, authenticated;
REVOKE ALL ON TABLE public.activity_logs FROM anon, authenticated;
REVOKE ALL ON TABLE public.users FROM anon, authenticated;
REVOKE ALL ON TABLE public.payments FROM anon, authenticated;
REVOKE ALL ON TABLE public.site_devices FROM anon, authenticated;
REVOKE ALL ON TABLE public.analytics_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.sonicpesa_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.checkout_payment_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.transactions FROM anon, authenticated;
REVOKE ALL ON TABLE public.device_subscriptions FROM anon, authenticated;
REVOKE ALL ON TABLE public.video_view_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.video_reports FROM anon, authenticated;

GRANT INSERT ON TABLE public.video_reports TO anon, authenticated;
GRANT SELECT ON TABLE public.videos TO anon, authenticated;
GRANT SELECT ON TABLE public.categories TO anon, authenticated;
GRANT SELECT ON TABLE public.vip_plans TO anon, authenticated;
GRANT SELECT ON TABLE public.apk_releases TO anon, authenticated;
GRANT SELECT ON TABLE public.site_settings TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.video_likes TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'videos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'vip_plans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vip_plans;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
