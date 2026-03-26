const { Client } = require('pg');

const connectionString = 'postgresql://postgres:SHBq6NygO80JwMdP@db.vsfijgaggpobdiwvdvxl.supabase.co:5432/postgres';

const rlsSQL = `
-- ============================================
-- Enable Row Level Security on all user tables
-- ============================================

-- 1. USERS table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- 2. TRANSACTIONS table
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- 3. CATEGORIES table (shared categories have NULL user_id, personal ones are user-scoped)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view categories" ON public.categories;
CREATE POLICY "Users can view categories" ON public.categories
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id);

-- 4. BUDGETS table
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own budgets" ON public.budgets;
CREATE POLICY "Users can view own budgets" ON public.budgets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budgets;
CREATE POLICY "Users can insert own budgets" ON public.budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
CREATE POLICY "Users can update own budgets" ON public.budgets
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budgets;
CREATE POLICY "Users can delete own budgets" ON public.budgets
  FOR DELETE USING (auth.uid() = user_id);

-- 5. SAVINGS_GOALS table
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own goals" ON public.savings_goals;
CREATE POLICY "Users can view own goals" ON public.savings_goals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goals" ON public.savings_goals;
CREATE POLICY "Users can insert own goals" ON public.savings_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goals" ON public.savings_goals;
CREATE POLICY "Users can update own goals" ON public.savings_goals
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own goals" ON public.savings_goals;
CREATE POLICY "Users can delete own goals" ON public.savings_goals
  FOR DELETE USING (auth.uid() = user_id);

-- 6. LOYALTY_CARDS table
ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own cards" ON public.loyalty_cards;
CREATE POLICY "Users can view own cards" ON public.loyalty_cards
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cards" ON public.loyalty_cards;
CREATE POLICY "Users can insert own cards" ON public.loyalty_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cards" ON public.loyalty_cards;
CREATE POLICY "Users can update own cards" ON public.loyalty_cards
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cards" ON public.loyalty_cards;
CREATE POLICY "Users can delete own cards" ON public.loyalty_cards
  FOR DELETE USING (auth.uid() = user_id);

-- 7. SHOPPING_LIST table
ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own list" ON public.shopping_list;
CREATE POLICY "Users can view own list" ON public.shopping_list
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own items" ON public.shopping_list;
CREATE POLICY "Users can insert own items" ON public.shopping_list
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own items" ON public.shopping_list;
CREATE POLICY "Users can update own items" ON public.shopping_list
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own items" ON public.shopping_list;
CREATE POLICY "Users can delete own items" ON public.shopping_list
  FOR DELETE USING (auth.uid() = user_id);

-- 8. SHARED_BUDGETS table
ALTER TABLE public.shared_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own shared budgets" ON public.shared_budgets;
CREATE POLICY "Owners can view own shared budgets" ON public.shared_budgets
  FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can insert shared budgets" ON public.shared_budgets;
CREATE POLICY "Owners can insert shared budgets" ON public.shared_budgets
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update shared budgets" ON public.shared_budgets;
CREATE POLICY "Owners can update shared budgets" ON public.shared_budgets
  FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete shared budgets" ON public.shared_budgets;
CREATE POLICY "Owners can delete shared budgets" ON public.shared_budgets
  FOR DELETE USING (auth.uid() = owner_id);

-- 9. SHARED_BUDGET_MEMBERS table
ALTER TABLE public.shared_budget_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view own memberships" ON public.shared_budget_members;
CREATE POLICY "Members can view own memberships" ON public.shared_budget_members
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can insert memberships" ON public.shared_budget_members;
CREATE POLICY "Members can insert memberships" ON public.shared_budget_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Revoke broad anon access (authenticated users still get access via RLS)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON public.categories TO anon;  -- allow anon to see shared categories only via RLS

-- Keep authenticated role access (RLS will filter)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
`;

async function setupRLS() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Enabling Row Level Security on all tables...');
    await client.query(rlsSQL);
    console.log('RLS policies created successfully!');
    console.log('');
    console.log('Summary of changes:');
    console.log('  - RLS enabled on: users, transactions, categories, budgets,');
    console.log('    savings_goals, loyalty_cards, shopping_list, shared_budgets,');
    console.log('    shared_budget_members');
    console.log('  - Each user can only SELECT/INSERT/UPDATE/DELETE their own rows');
    console.log('  - Categories with NULL user_id are visible to all (shared)');
    console.log('  - Revoked broad anon access');
  } catch (err) {
    console.error('RLS setup failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupRLS();
