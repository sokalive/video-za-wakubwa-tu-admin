-- Per-video VIP trial preview length in seconds (admin upload form)

ALTER TABLE videos ADD COLUMN IF NOT EXISTS vip_trial_seconds INT;

NOTIFY pgrst, 'reload schema';
