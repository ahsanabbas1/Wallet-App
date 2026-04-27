-- ============================================================
-- Wallet App v2 Migration
-- Paste this entire script into your Supabase SQL Editor and
-- click "Run". Safe to run multiple times.
-- ============================================================


-- ── 1. savings_goals: new columns ────────────────────────────────────────

ALTER TABLE savings_goals
  ADD COLUMN IF NOT EXISTS start_date   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS repeat_basis TEXT    DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS repeat_value INTEGER DEFAULT 0;


-- ── 2. categories: parent_id for sub-categories ──────────────────────────

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE SET NULL;


-- ── 3. shopping_lists ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shopping_lists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title       TEXT NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ── 4. shopping_items ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shopping_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id      UUID REFERENCES shopping_lists(id) ON DELETE CASCADE NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    quantity     INTEGER DEFAULT 1,
    price        DECIMAL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- In case shopping_items already existed without quantity/price
ALTER TABLE shopping_items
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS price    DECIMAL;


-- ── 5. warranties ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS warranties (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name          TEXT NOT NULL,
    purchase_date DATE,
    expiry_date   DATE,
    color         TEXT    DEFAULT '#4051b5',
    is_notified   BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ── 6. ai_usage ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_usage (
    user_id       UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    usage_date    DATE NOT NULL,
    request_count INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
);


-- ── 7. planned_payments ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS planned_payments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title       TEXT NOT NULL,
    amount      DECIMAL NOT NULL,
    frequency   TEXT DEFAULT 'monthly',
    next_date   DATE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ── 8. Enable RLS on all new tables ──────────────────────────────────────

ALTER TABLE shopping_lists   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranties       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage         ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_payments ENABLE ROW LEVEL SECURITY;


-- ── 9. RLS Policies (drop-then-create so re-runs don't error) ────────────

-- shopping_lists
DROP POLICY IF EXISTS "Users manage own shopping lists" ON shopping_lists;
CREATE POLICY "Users manage own shopping lists"
  ON shopping_lists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- shopping_items (access via owned list)
DROP POLICY IF EXISTS "Users manage items in own lists" ON shopping_items;
CREATE POLICY "Users manage items in own lists"
  ON shopping_items FOR ALL
  USING (
    list_id IN (SELECT id FROM shopping_lists WHERE user_id = auth.uid())
  )
  WITH CHECK (
    list_id IN (SELECT id FROM shopping_lists WHERE user_id = auth.uid())
  );

-- warranties
DROP POLICY IF EXISTS "Users manage own warranties" ON warranties;
CREATE POLICY "Users manage own warranties"
  ON warranties FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ai_usage
DROP POLICY IF EXISTS "Users manage own AI usage" ON ai_usage;
CREATE POLICY "Users manage own AI usage"
  ON ai_usage FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- planned_payments
DROP POLICY IF EXISTS "Users manage own planned payments" ON planned_payments;
CREATE POLICY "Users manage own planned payments"
  ON planned_payments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── Done ─────────────────────────────────────────────────────────────────
-- Tables created / columns added:
--   savings_goals     → start_date, repeat_basis, repeat_value
--   categories        → parent_id
--   shopping_lists    → new table
--   shopping_items    → new table (quantity, price included)
--   warranties        → new table
--   ai_usage          → new table
--   planned_payments  → new table
-- All new tables have RLS enabled with per-user access policies.
