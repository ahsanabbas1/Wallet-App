-- ============================================================
-- Wallet App v6 Migration - Enable Time Support for Planned Payments
-- Run this in Supabase SQL Editor -> Run
-- ============================================================

-- 1. Change next_date column to TIMESTAMP WITH TIME ZONE
-- This allows us to track exactly WHEN a payment is due (e.g., 1:00 PM)
ALTER TABLE planned_payments 
  ALTER COLUMN next_date TYPE TIMESTAMP WITH TIME ZONE;

-- 2. Update existing DATE strings to be mid-day timestamps if they are just dates
-- (Postgres handles this automatically when casting, but we'll be explicit)
UPDATE planned_payments 
SET next_date = next_date + time '12:00:00'
WHERE next_date::time = '00:00:00';
