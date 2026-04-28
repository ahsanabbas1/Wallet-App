-- ============================================================
-- Wallet App v5 Migration - Fix planned_payments schema
-- Fixes frequency CHECK constraint to allow custom intervals
-- Safe to run multiple times
-- ============================================================

-- Step 1: Drop the restrictive frequency CHECK constraint if it exists
-- (This allows custom:N format like custom:3, custom:7, etc)
ALTER TABLE IF EXISTS planned_payments
  DROP CONSTRAINT IF EXISTS planned_payments_frequency_check;

-- Step 2: Add a new CHECK constraint that allows all frequency formats
-- Allows: daily, weekly, monthly, yearly, and custom:N (where N is a number)
ALTER TABLE IF EXISTS planned_payments
  ADD CONSTRAINT planned_payments_frequency_check 
  CHECK (frequency ~ '^(daily|weekly|monthly|yearly|custom:\d+)$');

-- Step 3: Add missing columns if they don't exist
ALTER TABLE IF EXISTS planned_payments
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE IF EXISTS planned_payments
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'expense';

ALTER TABLE IF EXISTS planned_payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_planned_payments_user_id 
  ON planned_payments(user_id);

CREATE INDEX IF NOT EXISTS idx_planned_payments_next_date 
  ON planned_payments(next_date);

CREATE INDEX IF NOT EXISTS idx_planned_payments_is_active 
  ON planned_payments(is_active);
