# Planned Payments Frequency Constraint Error - Fix Guide

## Problem

You're seeing this error: **"Could not add payment. new row for relation 'planned_payment' violates check constraint 'planned_payments_frequency_check'"**

This happens because the `planned_payments` table's `frequency` column has a CHECK constraint that only allows predefined values (daily, weekly, monthly, yearly), but your app tries to insert custom frequency values like `custom:3` (every 3 days).

## Root Cause

The frequency CHECK constraint is too restrictive. It was likely added to enforce only standard frequencies, but the app's UI allows users to set custom intervals like "every 3 days" or "every 5 days", which are stored as `custom:3`, `custom:5`, etc.

## Solution

### Option 1: Quick Fix with Updated Migration (Recommended)

1. Go to your Supabase project: https://app.supabase.com/
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open and copy the entire content of `migration_v5_planned_payments_fix.sql`
5. Paste it into the SQL Editor
6. Click **Run**
7. Restart your app

This will:

- Drop the restrictive CHECK constraint
- Add a new flexible CHECK constraint that allows: `daily`, `weekly`, `monthly`, `yearly`, and `custom:N` (where N is any number)
- Add any missing columns (`is_active`, `type`, `updated_at`)
- Create performance indexes

### Option 2: Manual SQL Fix

Copy and paste this into your Supabase SQL Editor:

```sql
-- Step 1: Drop the restrictive constraint
ALTER TABLE IF EXISTS planned_payments
  DROP CONSTRAINT IF EXISTS planned_payments_frequency_check;

-- Step 2: Add a new constraint that allows custom:N format
ALTER TABLE IF EXISTS planned_payments
  ADD CONSTRAINT planned_payments_frequency_check
  CHECK (frequency ~ '^(daily|weekly|monthly|yearly|custom:\d+)$');

-- Step 3: Add missing columns
ALTER TABLE IF EXISTS planned_payments
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE IF EXISTS planned_payments
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'expense';

ALTER TABLE IF EXISTS planned_payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 4: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_planned_payments_user_id
  ON planned_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_planned_payments_next_date
  ON planned_payments(next_date);
CREATE INDEX IF NOT EXISTS idx_planned_payments_is_active
  ON planned_payments(is_active);
```

### Option 3: If You Only Use Standard Frequencies

If you only need daily, weekly, monthly, yearly (no custom intervals), just drop the constraint:

```sql
ALTER TABLE planned_payments
  DROP CONSTRAINT IF EXISTS planned_payments_frequency_check;
```

## Supported Frequency Values

After applying the fix, the app supports:

| Value       | Display       | Examples                               |
| ----------- | ------------- | -------------------------------------- |
| `daily`     | Daily         | Every day                              |
| `weekly`    | Weekly        | Every 7 days                           |
| `monthly`   | Monthly       | Every month                            |
| `yearly`    | Yearly        | Every year                             |
| `custom:1`  | Every 1 Day   | Custom: 1 day                          |
| `custom:3`  | Every 3 Days  | Custom: 3 days                         |
| `custom:7`  | Every 7 Days  | Custom: 7 days (alternative to weekly) |
| `custom:14` | Every 14 Days | Bi-weekly                              |
| `custom:30` | Every 30 Days | Custom month                           |
| `custom:N`  | Every N Days  | Any positive integer N                 |

## Understanding the Frequency Format

The app uses this format internally:

- **Standard frequencies**: Stored as `daily`, `weekly`, `monthly`, `yearly`
- **Custom intervals**: Stored as `custom:N` where N is the number of days
  - User selects "Custom" and enters "3" → stored as `custom:3`
  - User selects "Custom" and enters "30" → stored as `custom:30`

## Verification Steps

### Check the constraint was fixed:

```sql
SELECT constraint_name, check_clause
FROM information_schema.table_constraints
WHERE table_name = 'planned_payments'
AND constraint_type = 'CHECK';
```

You should see a constraint with the regex pattern allowing `custom:\d+`.

### Verify table structure:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'planned_payments'
ORDER BY ordinal_position;
```

### Test if custom frequency works:

```sql
INSERT INTO planned_payments (user_id, title, amount, frequency, next_date)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Test', 100, 'custom:3', '2024-05-01')
LIMIT 1;
```

## If You Still See Errors

1. **Constraint wasn't dropped**: Run the DROP command manually:

   ```sql
   ALTER TABLE planned_payments DROP CONSTRAINT IF EXISTS planned_payments_frequency_check;
   ```

2. **Multiple conflicting constraints**: List all constraints:

   ```sql
   SELECT constraint_name FROM information_schema.table_constraints
   WHERE table_name = 'planned_payments';
   ```

   Drop any that look like they restrict frequency:

   ```sql
   ALTER TABLE planned_payments DROP CONSTRAINT constraint_name;
   ```

3. **Clear app cache**:
   - Uninstall the app completely
   - Clear app data if on Android
   - Reinstall and test

4. **Check Supabase logs** for execution errors:
   - https://app.supabase.com/project/[YOUR-PROJECT-ID]/logs

## Code Context

How the app handles frequencies in `paymentService.js`:

```javascript
// Normalize user input to storage format
function normalizeFrequency(frequency, customDays) {
  if (frequency === "custom") {
    return `custom:${Math.max(1, Number(customDays) || 1)}`;
  }
  return frequency;
}

// Display format
function getFrequencyLabel(frequency) {
  if (frequency?.startsWith("custom:")) {
    const days = Number(frequency.split(":")[1] || 1);
    return `EVERY ${days} DAY${days === 1 ? "" : "S"}`;
  }
  return frequency.toUpperCase();
}

// Calculate next due date
function getNextOccurrence(dateString, frequency) {
  // ... standard frequencies use predefined intervals
  if (frequency?.startsWith("custom:")) {
    const days = Math.max(1, Number(frequency.split(":")[1] || 1));
    return formatLocalDate(addDays(baseDate, days));
  }
}
```

## Related Files

- `migration_v5_planned_payments_fix.sql` - The main fix migration with updated constraint
- `src/services/paymentService.js` - Handles frequency format conversion and calculations
- `src/screens/PlannedPayments/index.js` - UI for creating planned payments with custom frequency option
- `PLANNED_PAYMENTS_FIX.md` - Original fix guide for missing columns

## Next Steps

1. Apply the migration from Option 1 or 2 above
2. Restart your app
3. Try adding a planned payment with a custom frequency (e.g., every 3 days)
4. Verify it saves successfully and calculates next due dates correctly
