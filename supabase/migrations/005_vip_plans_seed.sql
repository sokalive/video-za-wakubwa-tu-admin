-- Default VIP subscription plans (idempotent — safe to re-run)
-- Run in Supabase SQL Editor or: npm run seed:vip-plans

INSERT INTO vip_plans (
  id,
  name,
  type,
  price,
  duration_days,
  duration_label,
  currency,
  features,
  is_active,
  popular
) VALUES
  (
    'plan-daily',
    '1 Day',
    'daily',
    2000,
    1,
    '1 Day',
    'TZS',
    ARRAY['Access all VIP videos', 'HD quality', 'No ads'],
    true,
    false
  ),
  (
    'plan-weekly',
    '1 Week',
    'weekly',
    8000,
    7,
    '1 Week',
    'TZS',
    ARRAY['Access all VIP videos', 'Full HD quality', 'No ads', 'Priority support'],
    true,
    true
  ),
  (
    'plan-monthly',
    '1 Month',
    'monthly',
    20000,
    30,
    '1 Month',
    'TZS',
    ARRAY['Access all VIP videos', 'Best quality', 'No ads', 'Unlimited downloads', 'VIP badge'],
    true,
    false
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  price = EXCLUDED.price,
  duration_days = EXCLUDED.duration_days,
  duration_label = EXCLUDED.duration_label,
  currency = EXCLUDED.currency,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  popular = EXCLUDED.popular;

NOTIFY pgrst, 'reload schema';
