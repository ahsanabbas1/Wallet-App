import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getDb, generateId } from '../lib/db';

const migrationKey = (userId) => `offline_migration_v1_${userId}`;

export async function isMigrationDone(userId) {
  const val = await AsyncStorage.getItem(migrationKey(userId));
  return val === 'true';
}

export async function markMigrationDone(userId) {
  await AsyncStorage.setItem(migrationKey(userId), 'true');
}

// Converts any value for SQLite storage
function toSql(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

async function batchInsert(db, table, rows, columns) {
  if (!rows || rows.length === 0) return;
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  for (const row of rows) {
    const vals = columns.map(c => toSql(row[c]));
    await db.runAsync(sql, vals);
  }
}

// Creates a minimal user row from auth data when Supabase users table is empty
async function ensureLocalUser(db, userId, session) {
  const existing = await db.getFirstAsync('SELECT id FROM users WHERE id = ?', [userId]);
  if (existing) return;
  const email = session?.user?.email || '';
  const name  = session?.user?.user_metadata?.name || email.split('@')[0] || 'User';
  await db.runAsync(
    `INSERT OR IGNORE INTO users (id, name, email, currency, theme, notifications_enabled, language, created_at)
     VALUES (?, ?, ?, 'PKR', 'dark', 1, 'en', ?)`,
    [userId, name, email, new Date().toISOString()]
  );
}

export async function runInitialMigration(userId, session, onProgress) {
  const db = getDb();
  const report = (msg) => { onProgress?.(msg); };

  report('Connecting to cloud…');

  // Fetch all tables in parallel — tolerate individual failures.
  // Supabase query builders are PromiseLike (have .then) but not full Promises
  // (no .catch), so we wrap in Promise.resolve() first to get a real Promise.
  const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
  const safe = (queryBuilder) =>
    Promise.race([Promise.resolve(queryBuilder), timeout(15000)]).catch(() => ({ data: [] }));

  const [
    usersRes, categoriesRes, transactionsRes, budgetsRes,
    goalsRes, loansRes, loanPaymentsRes, plannedRes,
    notifRes, settingsRes, listsRes, itemsRes, warrantiesRes,
  ] = await Promise.all([
    safe(supabase.from('users').select('*').eq('id', userId)),
    safe(supabase.from('categories').select('*').or(`user_id.eq.${userId},user_id.is.null`)),
    safe(supabase.from('transactions').select('*').eq('user_id', userId)),
    safe(supabase.from('budgets').select('*').eq('user_id', userId)),
    safe(supabase.from('savings_goals').select('*').eq('user_id', userId)),
    safe(supabase.from('loans').select('*').eq('user_id', userId)),
    safe(supabase.from('loan_payments').select('*, loans!inner(user_id)').eq('loans.user_id', userId)),
    safe(supabase.from('planned_payments').select('*').eq('user_id', userId)),
    safe(supabase.from('notifications').select('*').eq('user_id', userId)),
    safe(supabase.from('user_settings').select('*').eq('user_id', userId)),
    safe(supabase.from('shopping_lists').select('*').eq('user_id', userId)),
    safe(supabase.from('shopping_items').select('*, shopping_lists!inner(user_id)').eq('shopping_lists.user_id', userId)),
    safe(supabase.from('warranties').select('*').eq('user_id', userId)),
  ]);

  report('Saving data locally…');

  {
    // users
    await batchInsert(db, 'users', usersRes.data, [
      'id','name','email','avatar_url','currency','theme',
      'notifications_enabled','language','notification_prefs','created_at','updated_at',
    ]);

    // If no user row from Supabase (e.g. trigger delay on new account), create one locally
    await ensureLocalUser(db, userId, session);

    // categories
    await batchInsert(db, 'categories', categoriesRes.data, [
      'id','user_id','parent_id','name','icon','color','type','created_at',
    ]);

    // transactions
    await batchInsert(db, 'transactions', transactionsRes.data, [
      'id','user_id','category_id','amount','type','title','description','date','created_at',
    ]);

    // budgets
    await batchInsert(db, 'budgets', budgetsRes.data, [
      'id','user_id','category_id','total_amount','period','created_at',
    ]);

    // savings_goals
    await batchInsert(db, 'savings_goals', goalsRes.data, [
      'id','user_id','title','target_amount','saved_amount','icon','color',
      'start_date','target_date','repeat_basis','repeat_value','created_at',
    ]);

    // loans
    await batchInsert(db, 'loans', loansRes.data, [
      'id','user_id','type','person_name','total_amount','date','notes','is_settled','created_at',
    ]);

    // loan_payments — strip the joined loans object
    const cleanPayments = (loanPaymentsRes.data || []).map(({ loans: _l, ...p }) => p);
    await batchInsert(db, 'loan_payments', cleanPayments, [
      'id','loan_id','amount','date','notes','created_at',
    ]);

    // planned_payments
    await batchInsert(db, 'planned_payments', plannedRes.data, [
      'id','user_id','title','amount','type','frequency','next_date',
      'category_id','description','is_active','start_date','end_date','created_at',
    ]);

    // notifications — data column is JSONB in Supabase, TEXT in SQLite
    const notifs = (notifRes.data || []).map(n => ({
      ...n,
      data: n.data ? (typeof n.data === 'string' ? n.data : JSON.stringify(n.data)) : null,
    }));
    await batchInsert(db, 'notifications', notifs, [
      'id','user_id','type','title','body','data','dedup_key','is_read','created_at',
    ]);

    // user_settings — settings column is JSONB in Supabase, TEXT in SQLite
    const settings = (settingsRes.data || []).map(s => ({
      ...s,
      settings: s.settings ? (typeof s.settings === 'string' ? s.settings : JSON.stringify(s.settings)) : null,
    }));
    await batchInsert(db, 'user_settings', settings, [
      'user_id','settings','updated_at',
    ]);

    // shopping_lists
    await batchInsert(db, 'shopping_lists', listsRes.data, [
      'id','user_id','title','is_archived','created_at','updated_at',
    ]);

    // shopping_items — strip joined shopping_lists object
    const cleanItems = (itemsRes.data || []).map(({ shopping_lists: _l, ...item }) => item);
    await batchInsert(db, 'shopping_items', cleanItems, [
      'id','list_id','name','description','quantity','price','is_completed','created_at',
    ]);

    // warranties
    await batchInsert(db, 'warranties', warrantiesRes.data, [
      'id','user_id','name','purchase_date','expiry_date','color','is_notified','created_at',
    ]);
  }

  await markMigrationDone(userId);
  report('Done!');
}
