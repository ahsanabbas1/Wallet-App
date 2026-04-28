import { supabase } from '../lib/supabase';
import { paymentService } from './paymentService';

/* ─── Notification type registry ─────────────────────────────────────────── */

export const NOTIFICATION_TYPES = {
  PAYMENT_DUE:       'payment_due',
  BUDGET_WARNING:    'budget_warning',
  BUDGET_EXCEEDED:   'budget_exceeded',
  GOAL_MILESTONE:    'goal_milestone',
  GOAL_DEADLINE:     'goal_deadline',
  SPENDING_SPIKE:    'spending_spike',
  NEGATIVE_BALANCE:  'negative_balance',
  LARGE_TRANSACTION: 'large_transaction',
};

export const NOTIFICATION_META = {
  [NOTIFICATION_TYPES.PAYMENT_DUE]:       { label: 'Planned Payment Reminders', color: '#4051b5', icon: 'CalendarClock'  },
  [NOTIFICATION_TYPES.BUDGET_WARNING]:    { label: 'Budget Warning',            color: '#ff9800', icon: 'PieChart'       },
  [NOTIFICATION_TYPES.BUDGET_EXCEEDED]:   { label: 'Budget Exceeded',           color: '#f44336', icon: 'AlertTriangle'  },
  [NOTIFICATION_TYPES.GOAL_MILESTONE]:    { label: 'Savings Milestones',        color: '#0bda73', icon: 'Target'         },
  [NOTIFICATION_TYPES.GOAL_DEADLINE]:     { label: 'Goal Deadline Alerts',      color: '#ff9800', icon: 'Clock'          },
  [NOTIFICATION_TYPES.SPENDING_SPIKE]:    { label: 'Spending Spike Alerts',     color: '#f44336', icon: 'TrendingUp'     },
  [NOTIFICATION_TYPES.NEGATIVE_BALANCE]:  { label: 'Negative Balance Alerts',   color: '#f44336', icon: 'AlertOctagon'   },
  [NOTIFICATION_TYPES.LARGE_TRANSACTION]: { label: 'Large Transaction Alerts',  color: '#ff9800', icon: 'ArrowUpRight'   },
};

/* ─── Default preferences ────────────────────────────────────────────────── */

export const DEFAULT_PREFERENCES = {
  [NOTIFICATION_TYPES.PAYMENT_DUE]:       { enabled: true,  daysBefore: 1 },
  [NOTIFICATION_TYPES.BUDGET_WARNING]:    { enabled: true,  threshold: 80 },
  [NOTIFICATION_TYPES.BUDGET_EXCEEDED]:   { enabled: true                 },
  [NOTIFICATION_TYPES.GOAL_MILESTONE]:    { enabled: true,  milestones: [25, 50, 75, 100] },
  [NOTIFICATION_TYPES.GOAL_DEADLINE]:     { enabled: true,  daysBefore: 7 },
  [NOTIFICATION_TYPES.SPENDING_SPIKE]:    { enabled: true,  threshold: 30 },
  [NOTIFICATION_TYPES.NEGATIVE_BALANCE]:  { enabled: true                 },
  [NOTIFICATION_TYPES.LARGE_TRANSACTION]: { enabled: false, thresholdAmount: 10000 },
};

/* ─── Preferences CRUD ───────────────────────────────────────────────────── */

export const getPreferences = async (userId) => {
  try {
    const { data } = await supabase
      .from('users')
      .select('notification_prefs')
      .eq('id', userId)
      .single();

    const stored = data?.notification_prefs || {};
    const merged = {};
    Object.keys(DEFAULT_PREFERENCES).forEach(type => {
      merged[type] = { ...DEFAULT_PREFERENCES[type], ...(stored[type] || {}) };
    });
    return merged;
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
};

export const savePreferences = async (userId, prefs) => {
  try {
    await supabase
      .from('users')
      .update({ notification_prefs: prefs })
      .eq('id', userId);
    return true;
  } catch (e) {
    console.warn('savePreferences error:', e.message);
    return false;
  }
};

/* ─── Notification CRUD ──────────────────────────────────────────────────── */

export const getNotifications = async (userId, limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('getNotifications error:', e.message);
    return [];
  }
};

export const getUnreadCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
    return count || 0;
  } catch {
    return 0;
  }
};

export const markAsRead = async (notificationId) => {
  await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
};

export const markAllAsRead = async (userId) => {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
};

export const deleteNotification = async (id) => {
  await supabase.from('notifications').delete().eq('id', id);
};

export const clearAllNotifications = async (userId) => {
  await supabase.from('notifications').delete().eq('user_id', userId);
};

/* ─── Internal helper: insert with dedup ────────────────────────────────── */

const createNotification = async (userId, type, title, body, data = {}, dedupKey = null) => {
  try {
    if (dedupKey) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('dedup_key', dedupKey)
        .gte('created_at', cutoff)
        .limit(1);
      if (existing && existing.length > 0) return;
    }
    await supabase.from('notifications').insert({
      user_id: userId, type, title, body, data,
      dedup_key: dedupKey, is_read: false,
    });
  } catch (e) {
    console.warn('createNotification error:', e.message);
  }
};

/* ─── Helper: expand category IDs to include children ───────────────────── */

const getRelatedCategoryIds = (categoryId, allCategories) => {
  const children = allCategories.filter(c => c.parent_id === categoryId).map(c => c.id);
  return [categoryId, ...children];
};

/* ─── Individual generators ──────────────────────────────────────────────── */

const checkPlannedPayments = async (userId, prefs, currency) => {
  if (!prefs[NOTIFICATION_TYPES.PAYMENT_DUE]?.enabled) return;
  const daysBefore = prefs[NOTIFICATION_TYPES.PAYMENT_DUE]?.daysBefore ?? 1;

  const payments = await paymentService.getPlannedPayments(userId);

  if (!payments?.length) return;

  const now = new Date();
  for (const p of payments) {
    if (!p.next_date) continue;
    const due  = new Date(p.next_date);
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= daysBefore) {
      const dueLabel = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : `in ${diff} days`;
      await createNotification(
        userId,
        NOTIFICATION_TYPES.PAYMENT_DUE,
        `Payment Due: ${p.title}`,
        `${currency} ${parseFloat(p.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })} due ${dueLabel}.`,
        { payment_id: p.id, amount: p.amount, frequency: p.frequency },
        `payment_due_${p.id}_${due.toISOString().split('T')[0]}`
      );
    }
  }
};

const checkBudgets = async (userId, prefs, currency) => {
  const warnEnabled   = prefs[NOTIFICATION_TYPES.BUDGET_WARNING]?.enabled;
  const exceedEnabled = prefs[NOTIFICATION_TYPES.BUDGET_EXCEEDED]?.enabled;
  if (!warnEnabled && !exceedEnabled) return;

  const warnThreshold = (prefs[NOTIFICATION_TYPES.BUDGET_WARNING]?.threshold ?? 80) / 100;
  const now       = new Date();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // FIX: fetch all categories for hierarchy expansion
  const [budgetRes, allCatRes, txRes] = await Promise.all([
    supabase.from('budgets').select('id, category_id, total_amount, categories(name, color)').eq('user_id', userId).eq('period', periodKey),
    supabase.from('categories').select('id, parent_id').or(`user_id.eq.${userId},user_id.is.null`),
    supabase.from('transactions').select('category_id, amount').eq('user_id', userId).eq('type', 'expense').gte('date', monthStart).lte('date', monthEnd),
  ]);

  const budgets = budgetRes.data || [];
  const allCats = allCatRes.data || [];
  const txData  = txRes.data || [];

  if (!budgets.length) return;

  for (const budget of budgets) {
    // FIX: include sub-category transactions
    const relatedIds = getRelatedCategoryIds(budget.category_id, allCats);
    const spent = txData
      .filter(t => relatedIds.includes(t.category_id))
      .reduce((s, t) => s + parseFloat(t.amount), 0);

    const limit   = parseFloat(budget.total_amount);
    const ratio   = limit > 0 ? spent / limit : 0;
    const catName = budget.categories?.name || 'Category';

    if (exceedEnabled && ratio >= 1) {
      await createNotification(
        userId,
        NOTIFICATION_TYPES.BUDGET_EXCEEDED,
        `Budget Exceeded: ${catName}`,
        `You've spent ${currency} ${spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} against a ${currency} ${limit.toLocaleString(undefined, { maximumFractionDigits: 0 })} budget this month.`,
        { budget_id: budget.id, spent, limit },
        `budget_exceeded_${budget.id}_${periodKey}`
      );
    } else if (warnEnabled && ratio >= warnThreshold && ratio < 1) {
      const pct = (ratio * 100).toFixed(0);
      await createNotification(
        userId,
        NOTIFICATION_TYPES.BUDGET_WARNING,
        `Budget Warning: ${catName}`,
        `${pct}% of your ${catName} budget used. ${currency} ${(limit - spent).toLocaleString(undefined, { maximumFractionDigits: 0 })} remaining.`,
        { budget_id: budget.id, spent, limit, percent: ratio * 100 },
        `budget_warning_${budget.id}_${periodKey}`
      );
    }
  }
};

const checkSavingsGoals = async (userId, prefs, currency) => {
  const milestoneEnabled = prefs[NOTIFICATION_TYPES.GOAL_MILESTONE]?.enabled;
  const deadlineEnabled  = prefs[NOTIFICATION_TYPES.GOAL_DEADLINE]?.enabled;
  if (!milestoneEnabled && !deadlineEnabled) return;

  const milestones = prefs[NOTIFICATION_TYPES.GOAL_MILESTONE]?.milestones ?? [25, 50, 75, 100];
  const daysBefore = prefs[NOTIFICATION_TYPES.GOAL_DEADLINE]?.daysBefore  ?? 7;

  const { data: goals } = await supabase
    .from('savings_goals')
    .select('id, title, target_amount, saved_amount, target_date')
    .eq('user_id', userId);

  if (!goals?.length) return;

  const now = new Date();
  for (const goal of goals) {
    const saved  = parseFloat(goal.saved_amount  || 0);
    const target = parseFloat(goal.target_amount || 1);
    const pct    = (saved / target) * 100;

    if (milestoneEnabled) {
      for (const milestone of milestones) {
        if (pct >= milestone) {
          await createNotification(
            userId,
            NOTIFICATION_TYPES.GOAL_MILESTONE,
            milestone === 100 ? `🎉 Goal Reached: ${goal.title}` : `${milestone}% Milestone: ${goal.title}`,
            milestone === 100
              ? `Congratulations! You've reached your savings goal of ${currency} ${target.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`
              : `You've saved ${milestone}% toward "${goal.title}". Keep it up!`,
            { goal_id: goal.id, milestone, saved, target },
            `goal_milestone_${goal.id}_${milestone}`
          );
        }
      }
    }

    if (deadlineEnabled && goal.target_date) {
      const due  = new Date(goal.target_date);
      const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff <= daysBefore && pct < 100) {
        const remaining = target - saved;
        await createNotification(
          userId,
          NOTIFICATION_TYPES.GOAL_DEADLINE,
          `Goal Deadline: ${goal.title}`,
          `${diff === 0 ? 'Today is' : `${diff} days until`} the deadline. ${currency} ${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} still needed.`,
          { goal_id: goal.id, days_remaining: diff, remaining },
          `goal_deadline_${goal.id}_${due.toISOString().split('T')[0]}`
        );
      }
    }
  }
};

const checkSpendingSpike = async (userId, prefs, currency) => {
  if (!prefs[NOTIFICATION_TYPES.SPENDING_SPIKE]?.enabled) return;
  const threshold  = (prefs[NOTIFICATION_TYPES.SPENDING_SPIKE]?.threshold ?? 30) / 100;
  const now        = new Date();
  const curStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prvStart   = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const prvEnd     = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
  const periodKey  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [curRes, prvRes] = await Promise.all([
    supabase.from('transactions').select('amount').eq('user_id', userId).eq('type', 'expense').gte('date', curStart),
    supabase.from('transactions').select('amount').eq('user_id', userId).eq('type', 'expense').gte('date', prvStart).lte('date', prvEnd),
  ]);

  const cur = (curRes.data || []).reduce((s, t) => s + parseFloat(t.amount), 0);
  const prv = (prvRes.data || []).reduce((s, t) => s + parseFloat(t.amount), 0);

  if (prv > 0 && (cur - prv) / prv > threshold) {
    const pct = (((cur - prv) / prv) * 100).toFixed(0);
    await createNotification(
      userId,
      NOTIFICATION_TYPES.SPENDING_SPIKE,
      'Spending Spike Detected',
      `Your spending this month is ${pct}% higher than last month. ${currency} ${cur.toLocaleString(undefined, { maximumFractionDigits: 0 })} spent so far.`,
      { current: cur, previous: prv, increase_pct: pct },
      `spending_spike_${periodKey}`
    );
  }
};

const checkNegativeBalance = async (userId, prefs, currency) => {
  if (!prefs[NOTIFICATION_TYPES.NEGATIVE_BALANCE]?.enabled) return;

  const { data: txs } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('user_id', userId);

  if (!txs?.length) return;

  const balance = txs.reduce((s, t) => s + (t.type === 'income' ? 1 : -1) * parseFloat(t.amount), 0);
  if (balance < 0) {
    const periodKey = new Date().toISOString().split('T')[0];
    await createNotification(
      userId,
      NOTIFICATION_TYPES.NEGATIVE_BALANCE,
      'Negative Balance Alert',
      `Your overall balance is ${currency} ${Math.abs(balance).toLocaleString(undefined, { maximumFractionDigits: 0 })} in the red. Review your expenses.`,
      { balance },
      `negative_balance_${periodKey}`
    );
  }
};

const checkLargeTransactions = async (userId, prefs, currency) => {
  if (!prefs[NOTIFICATION_TYPES.LARGE_TRANSACTION]?.enabled) return;
  const threshold = prefs[NOTIFICATION_TYPES.LARGE_TRANSACTION]?.thresholdAmount ?? 10000;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: txs } = await supabase
    .from('transactions')
    .select('id, title, amount, categories(name)')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', yesterday)
    .gte('amount', threshold);

  if (!txs?.length) return;

  for (const t of txs) {
    await createNotification(
      userId,
      NOTIFICATION_TYPES.LARGE_TRANSACTION,
      `Large Expense: ${t.title || 'Transaction'}`,
      `A ${t.categories?.name || 'expense'} of ${currency} ${parseFloat(t.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })} was recorded.`,
      { transaction_id: t.id, amount: t.amount },
      `large_tx_${t.id}`
    );
  }
};

/* ─── Main: generate all notifications ──────────────────────────────────── */

export const generateNotifications = async (userId) => {
  try {
    // Fetch user currency once and pass to all checkers
    const profileRes = await supabase.from('users').select('currency').eq('id', userId).single();
    const currency   = profileRes.data?.currency || 'PKR';
    const prefs      = await getPreferences(userId);

    await Promise.all([
      checkPlannedPayments(userId, prefs, currency),
      checkBudgets(userId, prefs, currency),
      checkSavingsGoals(userId, prefs, currency),
      checkSpendingSpike(userId, prefs, currency),
      checkNegativeBalance(userId, prefs, currency),
      checkLargeTransactions(userId, prefs, currency),
    ]);
  } catch (e) {
    console.warn('generateNotifications error:', e.message);
  }
};
