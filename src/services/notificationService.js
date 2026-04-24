import { supabase } from '../lib/supabase';

/* ─── Notification type registry ─────────────────────────────────────────── */

export const NOTIFICATION_TYPES = {
  PAYMENT_DUE:       'payment_due',        // Planned payment due soon
  BUDGET_WARNING:    'budget_warning',     // Budget 80%+ spent
  BUDGET_EXCEEDED:   'budget_exceeded',    // Budget 100%+ spent
  GOAL_MILESTONE:    'goal_milestone',     // Goal hit 25/50/75/100 %
  GOAL_DEADLINE:     'goal_deadline',      // Goal deadline approaching
  SPENDING_SPIKE:    'spending_spike',     // Monthly spending up significantly
  NEGATIVE_BALANCE:  'negative_balance',   // Net balance went negative
  LARGE_TRANSACTION: 'large_transaction',  // Single expense above threshold
};

export const NOTIFICATION_META = {
  [NOTIFICATION_TYPES.PAYMENT_DUE]:       { label: 'Planned Payment Reminders', color: '#4051b5', icon: 'CalendarClock'      },
  [NOTIFICATION_TYPES.BUDGET_WARNING]:    { label: 'Budget Warning',            color: '#ff9800', icon: 'PieChart'           },
  [NOTIFICATION_TYPES.BUDGET_EXCEEDED]:   { label: 'Budget Exceeded',           color: '#f44336', icon: 'AlertTriangle'      },
  [NOTIFICATION_TYPES.GOAL_MILESTONE]:    { label: 'Savings Milestones',        color: '#0bda73', icon: 'Target'             },
  [NOTIFICATION_TYPES.GOAL_DEADLINE]:     { label: 'Goal Deadline Alerts',      color: '#ff9800', icon: 'Clock'              },
  [NOTIFICATION_TYPES.SPENDING_SPIKE]:    { label: 'Spending Spike Alerts',     color: '#f44336', icon: 'TrendingUp'         },
  [NOTIFICATION_TYPES.NEGATIVE_BALANCE]:  { label: 'Negative Balance Alerts',   color: '#f44336', icon: 'AlertOctagon'       },
  [NOTIFICATION_TYPES.LARGE_TRANSACTION]: { label: 'Large Transaction Alerts',  color: '#ff9800', icon: 'ArrowUpRight'       },
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
      .select('preferences')
      .eq('id', userId)
      .single();
    const stored = data?.preferences?.notification_prefs || {};
    // Deep merge with defaults so new types are always present
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
    const { data } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .single();
    const existing = data?.preferences || {};
    await supabase
      .from('users')
      .update({ preferences: { ...existing, notification_prefs: prefs } })
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
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
};

export const markAllAsRead = async (userId) => {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
};

export const deleteNotification = async (id) => {
  await supabase.from('notifications').delete().eq('id', id);
};

export const clearAllNotifications = async (userId) => {
  await supabase.from('notifications').delete().eq('user_id', userId);
};

/* ─── Internal helper: create a notification (dedup by dedup_key) ─────────── */

const createNotification = async (userId, type, title, body, data = {}, dedupKey = null) => {
  try {
    // If dedupKey provided, avoid creating a duplicate within 24 hours
    if (dedupKey) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('dedup_key', dedupKey)
        .gte('created_at', cutoff)
        .limit(1);
      if (existing && existing.length > 0) return; // already notified
    }

    await supabase.from('notifications').insert({
      user_id:    userId,
      type,
      title,
      body,
      data,
      dedup_key:  dedupKey,
      is_read:    false,
    });
  } catch (e) {
    console.warn('createNotification error:', e.message);
  }
};

/* ─── Individual notification generators ────────────────────────────────── */

const checkPlannedPayments = async (userId, prefs) => {
  if (!prefs[NOTIFICATION_TYPES.PAYMENT_DUE]?.enabled) return;
  const daysBefore = prefs[NOTIFICATION_TYPES.PAYMENT_DUE]?.daysBefore ?? 1;

  const { data: payments } = await supabase
    .from('planned_payments')
    .select('id, title, amount, type, next_date, frequency')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!payments) return;

  const now = new Date();
  for (const p of payments) {
    const due  = new Date(p.next_date);
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= daysBefore) {
      const dueLabel = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : `in ${diff} days`;
      await createNotification(
        userId,
        NOTIFICATION_TYPES.PAYMENT_DUE,
        `Payment Due: ${p.title}`,
        `PKR ${parseFloat(p.amount).toLocaleString('en-PK', { maximumFractionDigits: 0 })} ${p.type === 'expense' ? 'payment' : 'income'} is due ${dueLabel}.`,
        { payment_id: p.id, amount: p.amount, frequency: p.frequency },
        `payment_due_${p.id}_${due.toISOString().split('T')[0]}`
      );
    }
  }
};

const checkBudgets = async (userId, prefs) => {
  const warnEnabled    = prefs[NOTIFICATION_TYPES.BUDGET_WARNING]?.enabled;
  const exceedEnabled  = prefs[NOTIFICATION_TYPES.BUDGET_EXCEEDED]?.enabled;
  if (!warnEnabled && !exceedEnabled) return;

  const warnThreshold = (prefs[NOTIFICATION_TYPES.BUDGET_WARNING]?.threshold ?? 80) / 100;

  const now          = new Date();
  const periodKey    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd     = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data: budgets } = await supabase
    .from('budgets')
    .select('id, category_id, total_amount, categories(name, color)')
    .eq('user_id', userId);

  if (!budgets || !budgets.length) return;

  for (const budget of budgets) {
    const { data: txs } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('category_id', budget.category_id)
      .eq('type', 'expense')
      .gte('date', monthStart)
      .lte('date', monthEnd);

    const spent = (txs || []).reduce((s, t) => s + parseFloat(t.amount), 0);
    const limit = parseFloat(budget.total_amount);
    const ratio = limit > 0 ? spent / limit : 0;
    const catName = budget.categories?.name || 'Category';

    if (exceedEnabled && ratio >= 1) {
      await createNotification(
        userId,
        NOTIFICATION_TYPES.BUDGET_EXCEEDED,
        `Budget Exceeded: ${catName}`,
        `You've spent PKR ${spent.toLocaleString('en-PK', { maximumFractionDigits: 0 })} against a PKR ${limit.toLocaleString('en-PK', { maximumFractionDigits: 0 })} budget this month.`,
        { budget_id: budget.id, spent, limit },
        `budget_exceeded_${budget.id}_${periodKey}`
      );
    } else if (warnEnabled && ratio >= warnThreshold && ratio < 1) {
      const pct = (ratio * 100).toFixed(0);
      await createNotification(
        userId,
        NOTIFICATION_TYPES.BUDGET_WARNING,
        `Budget Warning: ${catName}`,
        `${pct}% of your ${catName} budget used. PKR ${(limit - spent).toLocaleString('en-PK', { maximumFractionDigits: 0 })} remaining.`,
        { budget_id: budget.id, spent, limit, percent: ratio * 100 },
        `budget_warning_${budget.id}_${periodKey}`
      );
    }
  }
};

const checkSavingsGoals = async (userId, prefs) => {
  const milestoneEnabled = prefs[NOTIFICATION_TYPES.GOAL_MILESTONE]?.enabled;
  const deadlineEnabled  = prefs[NOTIFICATION_TYPES.GOAL_DEADLINE]?.enabled;
  if (!milestoneEnabled && !deadlineEnabled) return;

  const milestones  = prefs[NOTIFICATION_TYPES.GOAL_MILESTONE]?.milestones ?? [25, 50, 75, 100];
  const daysBefore  = prefs[NOTIFICATION_TYPES.GOAL_DEADLINE]?.daysBefore  ?? 7;

  const { data: goals } = await supabase
    .from('savings_goals')
    .select('id, title, target_amount, saved_amount, target_date')
    .eq('user_id', userId);

  if (!goals) return;

  const now = new Date();
  for (const goal of goals) {
    const saved  = parseFloat(goal.saved_amount  || 0);
    const target = parseFloat(goal.target_amount || 1);
    const pct    = (saved / target) * 100;

    if (milestoneEnabled) {
      for (const milestone of milestones) {
        if (pct >= milestone) {
          const label = milestone === 100 ? '🎉 Goal Completed!' : `${milestone}% Milestone`;
          await createNotification(
            userId,
            NOTIFICATION_TYPES.GOAL_MILESTONE,
            `${label}: ${goal.title}`,
            milestone === 100
              ? `Congratulations! You've reached your savings goal of PKR ${target.toLocaleString('en-PK', { maximumFractionDigits: 0 })}.`
              : `You've saved ${milestone}% of your target for "${goal.title}". Keep it up!`,
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
          `${diff === 0 ? 'Today is' : `${diff} days until`} the deadline for "${goal.title}". PKR ${remaining.toLocaleString('en-PK', { maximumFractionDigits: 0 })} still needed.`,
          { goal_id: goal.id, days_remaining: diff, remaining },
          `goal_deadline_${goal.id}_${due.toISOString().split('T')[0]}`
        );
      }
    }
  }
};

const checkSpendingSpike = async (userId, prefs) => {
  if (!prefs[NOTIFICATION_TYPES.SPENDING_SPIKE]?.enabled) return;
  const threshold = (prefs[NOTIFICATION_TYPES.SPENDING_SPIKE]?.threshold ?? 30) / 100;

  const now     = new Date();
  const curStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prvStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const prvEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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
      `Spending Spike Detected`,
      `Your spending this month is ${pct}% higher than last month. You've spent PKR ${cur.toLocaleString('en-PK', { maximumFractionDigits: 0 })} so far.`,
      { current: cur, previous: prv, increase_pct: pct },
      `spending_spike_${periodKey}`
    );
  }
};

const checkNegativeBalance = async (userId, prefs) => {
  if (!prefs[NOTIFICATION_TYPES.NEGATIVE_BALANCE]?.enabled) return;

  const { data: txs } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('user_id', userId);

  if (!txs) return;

  const balance = txs.reduce((s, t) => s + (t.type === 'income' ? 1 : -1) * parseFloat(t.amount), 0);
  if (balance < 0) {
    const periodKey = new Date().toISOString().split('T')[0];
    await createNotification(
      userId,
      NOTIFICATION_TYPES.NEGATIVE_BALANCE,
      'Negative Balance Alert',
      `Your overall balance is PKR ${Math.abs(balance).toLocaleString('en-PK', { maximumFractionDigits: 0 })} in the red. Review your expenses.`,
      { balance },
      `negative_balance_${periodKey}`
    );
  }
};

const checkLargeTransactions = async (userId, prefs) => {
  if (!prefs[NOTIFICATION_TYPES.LARGE_TRANSACTION]?.enabled) return;
  const threshold = prefs[NOTIFICATION_TYPES.LARGE_TRANSACTION]?.thresholdAmount ?? 10000;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: txs } = await supabase
    .from('transactions')
    .select('id, title, amount, type, date, categories(name)')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', yesterday)
    .gte('amount', threshold);

  if (!txs) return;

  for (const t of txs) {
    await createNotification(
      userId,
      NOTIFICATION_TYPES.LARGE_TRANSACTION,
      `Large Expense: ${t.title || 'Transaction'}`,
      `A ${t.categories?.name || 'expense'} of PKR ${parseFloat(t.amount).toLocaleString('en-PK', { maximumFractionDigits: 0 })} was recorded.`,
      { transaction_id: t.id, amount: t.amount },
      `large_tx_${t.id}`
    );
  }
};

/* ─── Main: generate all notifications ──────────────────────────────────── */

export const generateNotifications = async (userId) => {
  try {
    const prefs = await getPreferences(userId);
    await Promise.all([
      checkPlannedPayments(userId, prefs),
      checkBudgets(userId, prefs),
      checkSavingsGoals(userId, prefs),
      checkSpendingSpike(userId, prefs),
      checkNegativeBalance(userId, prefs),
      checkLargeTransactions(userId, prefs),
    ]);
  } catch (e) {
    console.warn('generateNotifications error:', e.message);
  }
};
