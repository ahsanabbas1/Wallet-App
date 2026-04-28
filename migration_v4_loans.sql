-- ============================================================
-- Wallet App v4 — Loan Management Migration
-- Paste into Supabase SQL Editor → Run.
-- ============================================================

-- 1. loans table
CREATE TABLE IF NOT EXISTS loans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('given', 'received')),
  person_name TEXT NOT NULL,
  total_amount DECIMAL NOT NULL CHECK (total_amount > 0),
  date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes       TEXT,
  is_settled  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. loan_payments table
CREATE TABLE IF NOT EXISTS loan_payments (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id  UUID REFERENCES loans(id) ON DELETE CASCADE NOT NULL,
  amount   DECIMAL NOT NULL CHECK (amount > 0),
  date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_loans_user_id     ON loans (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments (loan_id, date DESC);

-- 4. RLS
ALTER TABLE loans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own loans"          ON loans;
DROP POLICY IF EXISTS "Users manage own loan payments"  ON loan_payments;

CREATE POLICY "Users manage own loans"
  ON loans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own loan payments"
  ON loan_payments FOR ALL
  USING  (loan_id IN (SELECT id FROM loans WHERE user_id = auth.uid()))
  WITH CHECK (loan_id IN (SELECT id FROM loans WHERE user_id = auth.uid()));

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE loans;
ALTER PUBLICATION supabase_realtime ADD TABLE loan_payments;
