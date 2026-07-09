-- Reporting baseline for admin revenue counter (does not delete transactions).
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS revenue_reset_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
