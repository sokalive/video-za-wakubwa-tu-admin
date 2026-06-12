-- VIP plan flexibility + global/video trial settings (idempotent)

-- Relax legacy plan type constraint
ALTER TABLE vip_plans DROP CONSTRAINT IF EXISTS vip_plans_type_check;

ALTER TABLE vip_plans ADD COLUMN IF NOT EXISTS duration_value INT;
ALTER TABLE vip_plans ADD COLUMN IF NOT EXISTS duration_unit TEXT DEFAULT 'days';

UPDATE vip_plans
SET
  duration_value = COALESCE(duration_value, duration_days, 1),
  duration_unit = COALESCE(NULLIF(duration_unit, ''), 'days')
WHERE duration_value IS NULL OR duration_unit IS NULL OR duration_unit = '';

UPDATE vip_plans SET duration_value = 1, duration_unit = 'days'
WHERE id = 'plan-daily' AND (duration_value IS NULL OR duration_value = 0);

UPDATE vip_plans SET duration_value = 7, duration_unit = 'days'
WHERE id = 'plan-weekly' AND (duration_value IS NULL OR duration_value = 0);

UPDATE vip_plans SET duration_value = 30, duration_unit = 'days'
WHERE id = 'plan-monthly' AND (duration_value IS NULL OR duration_value = 0);

ALTER TABLE vip_plans ALTER COLUMN duration_value SET DEFAULT 1;
ALTER TABLE vip_plans ALTER COLUMN duration_unit SET DEFAULT 'days';

-- Global VIP trial (site_settings)
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS vip_trial_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS vip_trial_duration_value INT NOT NULL DEFAULT 5;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS vip_trial_duration_unit TEXT NOT NULL DEFAULT 'minutes';

-- Per-video trial override
ALTER TABLE videos ADD COLUMN IF NOT EXISTS trial_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS trial_duration_value INT NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS trial_duration_unit TEXT NOT NULL DEFAULT 'minutes';

NOTIFY pgrst, 'reload schema';
