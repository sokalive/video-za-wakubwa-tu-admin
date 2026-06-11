-- Seed production admin account
-- Run in Supabase SQL Editor if npm run seed:admin is unavailable
-- Password: Isamu2025 (bcrypt cost 12)

INSERT INTO admins (email, name, password_hash, role)
VALUES (
  'waziriissa37@gmail.com',
  'Waziri Admin',
  '$2b$12$GlQ2Pr0wq08U3pUZ6Yb2cuoeOfn.vznXKhTh3MsqW290KW.uJ9GRq',
  'super_admin'
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role;
