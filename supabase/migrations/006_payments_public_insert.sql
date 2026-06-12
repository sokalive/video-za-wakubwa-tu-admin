-- Allow website VIP pay route to record payments (idempotent)
-- Admin reads payments via service role (bypasses RLS). No public SELECT policy.

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert payments" ON payments;
CREATE POLICY "Public insert payments"
  ON payments FOR INSERT
  TO anon, authenticated
  WITH CHECK (status IN ('completed', 'pending', 'failed', 'refunded'));
