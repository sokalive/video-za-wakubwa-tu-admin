-- APK version history + admin dashboard support

ALTER TABLE apk_releases ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT false;

UPDATE apk_releases SET is_current = true WHERE id = 'current' AND is_current = false;

CREATE INDEX IF NOT EXISTS apk_releases_is_current_idx ON apk_releases (is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS apk_releases_created_at_idx ON apk_releases (created_at DESC);

NOTIFY pgrst, 'reload schema';
