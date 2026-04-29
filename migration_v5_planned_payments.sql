-- ============================================================
-- Wallet App v5 — Planned Payments Schema Fix
-- Run this in Supabase SQL Editor → Run.
-- Safe to run multiple times.
-- ============================================================

-- Add missing columns to planned_payments
ALTER TABLE planned_payments
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_date  DATE,
  ADD COLUMN IF NOT EXISTS end_date    DATE,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Backfill start_date for existing rows (use created_at date)
UPDATE planned_payments
SET start_date = created_at::DATE
WHERE start_date IS NULL;

-- Ensure realtime is enabled
ALTER PUBLICATION supabase_realtime ADD TABLE planned_payments;
