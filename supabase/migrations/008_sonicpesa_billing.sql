-- SonicPesa billing tables (idempotent — mirrors Osmani TV billing schema, adapted for vip_plans TEXT ids)

CREATE TABLE IF NOT EXISTS sonicpesa_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  api_endpoint TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  account_id TEXT NOT NULL DEFAULT '',
  webhook_url TEXT NOT NULL DEFAULT '',
  last_test_at TIMESTAMPTZ,
  last_test_ok BOOLEAN,
  last_test_message TEXT,
  last_webhook_at TIMESTAMPTZ,
  last_webhook_event TEXT NOT NULL DEFAULT '',
  last_webhook_order_id TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sonicpesa_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS checkout_payment_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payment_provider TEXT NOT NULL DEFAULT 'legacy',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE checkout_payment_settings DROP CONSTRAINT IF EXISTS checkout_payment_provider_check;
ALTER TABLE checkout_payment_settings ADD CONSTRAINT checkout_payment_provider_check
  CHECK (payment_provider IN ('legacy', 'sonicpesa'));

INSERT INTO checkout_payment_settings (id, payment_provider) VALUES (1, 'legacy')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  external_id TEXT,
  plan_id TEXT REFERENCES vip_plans(id) ON DELETE SET NULL,
  phone TEXT NOT NULL DEFAULT '',
  amount INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TZS',
  status TEXT NOT NULL DEFAULT 'pending',
  raw_payload JSONB DEFAULT '{}'::jsonb,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transactions_status_check CHECK (status IN ('pending', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS transactions_created_idx ON transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions (status);
CREATE INDEX IF NOT EXISTS transactions_device_id_idx ON transactions (device_id)
  WHERE device_id IS NOT NULL AND trim(device_id) <> '';
CREATE INDEX IF NOT EXISTS transactions_external_id_idx ON transactions (external_id)
  WHERE external_id IS NOT NULL AND trim(external_id) <> '';

CREATE TABLE IF NOT EXISTS device_subscriptions (
  device_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction_id TEXT NOT NULL UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT device_subscriptions_status_check CHECK (status IN ('active', 'pending'))
);

CREATE INDEX IF NOT EXISTS device_subscriptions_transaction_id_idx ON device_subscriptions (transaction_id);

NOTIFY pgrst, 'reload schema';
