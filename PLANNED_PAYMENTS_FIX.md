# Planned Payments Schema Error - Fix Guide

## Problem

You're seeing this error: **"Could not add payment. Could not find the 'is_active' column of 'planned_payments' in the schema cache"**

This happens because the `planned_payments` table exists but is missing required columns, particularly the `is_active` column.

## Root Cause

The `planned_payments` table was introduced in migration_v2.sql with the `is_active` column, but:

1. The migration might not have been fully applied to your Supabase database
2. Or the table was created without all the required columns

## Solution

### Option 1: Quick Fix (Recommended)

Run the SQL migration in your Supabase SQL Editor:

1. Go to your Supabase project: https://app.supabase.com/
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Paste the entire content of `migration_v5_planned_payments_fix.sql`
5. Click **Run**

This will:

- Add the `is_active` column (if missing)
- Add the `type` column (if missing)
- Add the `updated_at` column (if missing)
- Create necessary indexes for performance

### Option 2: Manual Migration

Copy and paste this SQL into your Supabase SQL Editor:

```sql
-- Add is_active column if it doesn't exist
ALTER TABLE IF EXISTS planned_payments
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add type column if it doesn't exist (for expense/income)
ALTER TABLE IF EXISTS planned_payments
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'expense';

-- Ensure updated_at column exists
ALTER TABLE IF EXISTS planned_payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create an index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_planned_payments_user_id
  ON planned_payments(user_id);

-- Create an index on next_date for faster sorting
CREATE INDEX IF NOT EXISTS idx_planned_payments_next_date
  ON planned_payments(next_date);

-- Create an index on is_active for faster filtering
CREATE INDEX IF NOT EXISTS idx_planned_payments_is_active
  ON planned_payments(is_active);
```

### Option 3: Full Schema Reset (If Table is Corrupted)

If the table is severely corrupted, follow these steps:

1. Run this in your Supabase SQL Editor to drop and recreate:

```sql
DROP TABLE IF EXISTS planned_payments CASCADE;

CREATE TABLE IF NOT EXISTS planned_payments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title       TEXT NOT NULL,
    amount      DECIMAL NOT NULL,
    frequency   TEXT DEFAULT 'monthly',
    next_date   DATE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    type        TEXT DEFAULT 'expense',
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE planned_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "Users manage own planned payments" ON planned_payments;
CREATE POLICY "Users manage own planned payments"
  ON planned_payments FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_planned_payments_user_id ON planned_payments(user_id);
CREATE INDEX idx_planned_payments_next_date ON planned_payments(next_date);
CREATE INDEX idx_planned_payments_is_active ON planned_payments(is_active);

-- Enable Realtime (if desired)
ALTER PUBLICATION supabase_realtime ADD TABLE planned_payments;
```

2. Delete your app's local database cache (if using SQLite/React Native storage)
3. Restart the app

## Code Changes Made

I've also improved the error detection in `paymentService.js` to handle more error message formats. The app now:

- Detects missing `is_active` column more reliably
- Has built-in fallback to work without `is_active` if needed
- Will automatically retry operations without `is_active` if the column is missing

## After Applying the Fix

1. The app will automatically detect the column exists
2. You'll be able to add planned payments without errors
3. The app can soft-delete payments via `is_active = false` instead of hard deletes

## If You Still See Errors

1. **Clear app cache**: Delete app data and reinstall
2. **Check Supabase logs**: https://app.supabase.com/project/[YOUR-PROJECT]/logs
3. **Verify table exists**: Run in SQL Editor:
   ```sql
   SELECT * FROM planned_payments LIMIT 1;
   ```
4. **Check table structure**: Run in SQL Editor:
   ```sql
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'planned_payments';
   ```

## Related Files

- `migration_v2.sql` - Original planned_payments table definition
- `migration_v5_planned_payments_fix.sql` - Fix migration
- `src/services/paymentService.js` - Payment service with improved error handling
- `src/screens/PlannedPayments/index.js` - Planned Payments UI screen

## Support

If problems persist:

1. Check your Supabase project's activity logs for any SQL errors
2. Ensure your Supabase account has not hit any plan limits
3. Try clearing all app cache and rebuilding
