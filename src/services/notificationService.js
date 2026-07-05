import { getDb, generateId } from '../lib/db';
import { paymentService } from './paymentService';

export const NOTIFICATION_TYPES = {
  PAYMENT_DUE: 'payment_due',
  BUDGET_WARNING: 'budget_warning',
  BUDGET_EXCEEDED: 'budget_exceeded',
  GOAL_MILESTONE: 'goal_milestone',
  GOAL_DEADLINE: 'goal_deadline',
  SPENDING_SPIKE: 'spending_spike',
  NEGATIVE_BALANCE: 'negative_balance',
  LARGE_TRANSACTION: 'large_transaction',
  LOAN_DUE: 'loan_due',
  LOAN_OVERDUE: 'loan_overdue',
};

export const NOTIFICATION_META = {
  [NOTIFICATION_TYPES.PAYMENT_DUE]: { label: 'Planned Payment Reminders', color: '#4051b5', icon: 'CalendarClock' },
  [NOTIFICATION_TYPES.BUDGET_WARNING]: { label: 'Budget Warning', color: '#ff9800', icon: 'PieChart' },
  [NOTIFICATION_TYPES.BUDGET_EXCEEDED]: { label: 'Budget Exceeded', color: '#f44336', icon: 'AlertTriangle' },
  [NOTIFICATION_TYPES.GOAL_MILESTONE]: { label: 'Savings Milestones', color: '#0bda73', icon: 'Target' },
  [NOTIFICATION_TYPES.GOAL_DEADLINE]: { label: 'Goal Deadline Alerts', color: '#ff9800', icon: 'Clock' },
  [NOTIFICATION_TYPES.SPENDING_SPIKE]: { label: 'Spending Spike Alerts', color: '#f44336', icon: 'TrendingUp' },
  [NOTIFICATION_TYPES.NEGATIVE_BALANCE]: { label: 'Negative Balance Alerts', color: '#f44336', icon: 'AlertOctagon' },
  [NOTIFICATION_TYPES.LARGE_TRANSACTION]: { label: 'Large Transaction Alerts', color: '#ff9800', icon: 'ArrowUpRight' },
  [NOTIFICATION_TYPES.LOAN_DUE]: { label: 'Loan Due Reminders', color: '#9C27B0', icon: 'AlertCircle' },
  [NOTIFICATION_TYPES.LOAN_OVERDUE]: { label: 'Overdue Loan Alerts', color: '#f44336', icon: 'AlertOctagon' },
};

export const DEFAULT_PREFERENCES = {
  [NOTIFICATION_TYPES.PAYMENT_DUE]: { enabled: true, daysBefore: 1 },
  [NOTIFICATION_TYPES.BUDGET_WARNING]: { enabled: true, threshold: 80 },
  [NOTIFICATION_TYPES.BUDGET_EXCEEDED]: { enabled: true },
  [NOTIFICATION_TYPES.GOAL_MILESTONE]: { enabled: true, milestones: [25, 50, 75, 100] },
  [NOTIFICATION_TYPES.GOAL_DEADLINE]: { enabled: true, daysBefore: 7 },
  [NOTIFICATION_TYPES.SPENDING_SPIKE]: { enabled: true, threshold: 30 },
  [NOTIFICATION_TYPES.NEGATIVE_BALANCE]: { enabled: true },
  [NOTIFICATION_TYPES.LARGE_TRANSACTION]: { enabled: false, thresholdAmount: 10000 },
  [NOTIFICATION_TYPES.LOAN_DUE]: { enabled: true, daysBefore: 3 },
  [NOTIFICATION_TYPES.LOAN_OVERDUE]: { enabled: true },
};

/* ── Preferences ──────────────────────────────────────────────────────────── */

export const getPreferences = async (userId) => {
  try {
    const db = getDb();
    const row = await db.getFirstAsync('SELECT notification_prefs FROM users WHERE id = ?', [userId]);
    const stored = row?.notification_prefs
      ? JSON.parse(row.notification_prefs)
      : {};
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
    const db = getDb();
    await db.runAsync(
      'UPDATE users SET notification_prefs = ? WHERE id = ?',
      [JSON.stringify(prefs), userId]
    );
    return true;
  } catch (e) {
    console.warn('savePreferences error:', e.message);
    return false;
  }
};

/* ── Notification CRUD ────────────────────────────────────────────────────── */

export const getNotifications = async (userId, limit = 50) => {
  try {
    const db = getDb();
    const rows = await db.getAllAsync(
      'SELECT * FROM notifications WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
    return rows.map(n => ({ ...n, is_read: n.is_read === 1, data: n.data ? JSON.parse(n.data) : null }));
  } catch (e) {
    console.warn('getNotifications error:', e.message);
    return [];
  }
};

export const getUnreadCount = async (userId) => {
  try {
    const db = getDb();
    const row = await db.getFirstAsync(
      'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return row?.cnt ?? 0;
  } catch { return 0; }
};

export const markAsRead = async (notificationId) => {
  try {
    const db = getDb();
    await db.runAsync('UPDATE notifications SET is_read = 1 WHERE id = ?', [notificationId]);
  } catch { }
};

export const markAllAsRead = async (userId) => {
  try {
    const db = getDb();
    await db.runAsync('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
  } catch { }
};

export const deleteNotification = async (id) => {
  try {
    const db = getDb();
    await db.runAsync('DELETE FROM notifications WHERE id = ?', [id]);
  } catch { }
};

export const clearAllNotifications = async (userId) => {
  try {
    const db = getDb();
    await db.runAsync('UPDATE notifications SET is_archived = 1 WHERE user_id = ? AND is_archived = 0', [userId]);
  } catch { }
};

export const archiveNotification = async (id) => {
  try {
    const db = getDb();
    await db.runAsync('UPDATE notifications SET is_archived = 1 WHERE id = ?', [id]);
  } catch { }
};

export const archiveOldNotifications = async (userId) => {
  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.runAsync(
      'UPDATE notifications SET is_archived = 1 WHERE user_id = ? AND is_archived = 0 AND created_at < ?',
      [userId, cutoff]
    );
  } catch { }
};

export const getArchivedNotifications = async (userId, limit = 50) => {
  try {
    const db = getDb();
    const rows = await db.getAllAsync(
      'SELECT * FROM notifications WHERE user_id = ? AND is_archived = 1 ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
    return rows.map(n => ({ ...n, is_read: n.is_read === 1, data: n.data ? JSON.parse(n.data) : null }));
  } catch (e) {
    console.warn('getArchivedNotifications error:', e.message);
    return [];
  }
};

/* ── Internal: dedup insert ───────────────────────────────────────────────── */

const createNotification = async (userId, type, title, body, data = {}, dedupKey = null, dedupForever = false) => {
  try {
    const db = getDb();
    if (dedupKey) {
      let existing;
      if (dedupForever) {
        existing = await db.getFirstAsync(
          'SELECT id FROM notifications WHERE user_id = ? AND dedup_key = ? LIMIT 1',
          [userId, dedupKey]
        );
      } else {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        existing = await db.getFirstAsync(
          'SELECT id FROM notifications WHERE user_id = ? AND dedup_key = ? AND created_at >= ? LIMIT 1',
          [userId, dedupKey, cutoff]
        );
      }
      if (existing) return;
    }
    await db.runAsync(
      `INSERT INTO notifications (id, user_id, type, title, body, data, dedup_key, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [generateId(), userId, type, title, body, JSON.stringify(data), dedupKey ?? null, new Date().toISOString()]
    );
  } catch (e) {
    console.warn('createNotification error:', e.message);
  }
};

/* ── Generators ───────────────────────────────────────────────────────────── */

const getRelatedCategoryIds = (categoryId, allCategories) => {
  const children = allCategories.filter(c => c.parent_id === categoryId).map(c => c.id);
  return [categoryId, ...children];
};

const checkPlannedPayments = async (userId, prefs, currency) => {
  if (!prefs[NOTIFICATION_TYPES.PAYMENT_DUE]?.enabled) return;
  const daysBefore = prefs[NOTIFICATION_TYPES.PAYMENT_DUE]?.daysBefore ?? 1;
  const payments = await paymentService.getPlannedPayments(userId);
  if (!payments?.length) return;
  const now = new Date();
  for (const p of payments) {
    if (!p.next_date) continue;
    const due = new Date(p.next_date);
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= daysBefore) {
      const dueLabel = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : `in ${diff} days`;
      await createNotification(
        userId, NOTIFICATION_TYPES.PAYMENT_DUE,
        `Payment Due: ${p.title}`,
        `${currency} ${parseFloat(p.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })} due ${dueLabel}.`,
        { payment_id: p.id, amount: p.amount, frequency: p.frequency },
        `payment_due_${p.id}_${due.toISOString().split('T')[0]}`,
        true
      );
    }
  }
};

const checkBudgets = async (userId, prefs, currency) => {
  const warnEnabled = prefs[NOTIFICATION_TYPES.BUDGET_WARNING]?.enabled;
  const exceedEnabled = prefs[NOTIFICATION_TYPES.BUDGET_EXCEEDED]?.enabled;
  if (!warnEnabled && !exceedEnabled) return;

  const warnThreshold = (prefs[NOTIFICATION_TYPES.BUDGET_WARNING]?.threshold ?? 80) / 100;
  const now = new Date();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const db = getDb();
  const budgets = await db.getAllAsync('SELECT * FROM budgets WHERE user_id = ?', [userId]);
  const allCats = await db.getAllAsync('SELECT id, parent_id, name, color FROM categories WHERE user_id = ? OR user_id IS NULL', [userId]);
  const txData = await db.getAllAsync(
    "SELECT category_id, amount FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?",
    [userId, monthStart, monthEnd]
  );
  const catMap = Object.fromEntries(allCats.map(c => [c.id, c]));

  if (!budgets.length) return;

  for (const budget of budgets) {
    const relatedIds = getRelatedCategoryIds(budget.category_id, allCats);
    const spent = txData
      .filter(t => relatedIds.includes(t.category_id))
      .reduce((s, t) => s + parseFloat(t.amount), 0);
    const limit = parseFloat(budget.total_amount);
    const ratio = limit > 0 ? spent / limit : 0;
    const catName = catMap[budget.category_id]?.name || 'Category';

    if (exceedEnabled && ratio >= 1) {
      await createNotification(
        userId, NOTIFICATION_TYPES.BUDGET_EXCEEDED,
        `Budget Exceeded: ${catName}`,
        `You've spent ${currency} ${spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} against a ${currency} ${limit.toLocaleString(undefined, { maximumFractionDigits: 0 })} budget this month.`,
        { budget_id: budget.id, spent, limit },
        `budget_exceeded_${budget.id}_${periodKey}`,
        true
      );
    } else if (warnEnabled && ratio >= warnThreshold && ratio < 1) {
      const pct = (ratio * 100).toFixed(0);
      await createNotification(
        userId, NOTIFICATION_TYPES.BUDGET_WARNING,
        `Budget Warning: ${catName}`,
        `${pct}% of your ${catName} budget used. ${currency} ${(limit - spent).toLocaleString(undefined, { maximumFractionDigits: 0 })} remaining.`,
        { budget_id: budget.id, spent, limit, percent: ratio * 100 },
        `budget_warning_${budget.id}_${periodKey}`,
        true
      );
    }
  }
};

const checkSavingsGoals = async (userId, prefs, currency) => {
  const milestoneEnabled = prefs[NOTIFICATION_TYPES.GOAL_MILESTONE]?.enabled;
  const deadlineEnabled = prefs[NOTIFICATION_TYPES.GOAL_DEADLINE]?.enabled;
  if (!milestoneEnabled && !deadlineEnabled) return;

  const milestones = prefs[NOTIFICATION_TYPES.GOAL_MILESTONE]?.milestones ?? [25, 50, 75, 100];
  const daysBefore = prefs[NOTIFICATION_TYPES.GOAL_DEADLINE]?.daysBefore ?? 7;

  const db = getDb();
  const goals = await db.getAllAsync(
    'SELECT id, title, target_amount, saved_amount, target_date FROM savings_goals WHERE user_id = ?',
    [userId]
  );
  if (!goals?.length) return;

  const now = new Date();
  for (const goal of goals) {
    const saved = parseFloat(goal.saved_amount || 0);
    const target = parseFloat(goal.target_amount || 1);
    const pct = (saved / target) * 100;

    if (milestoneEnabled) {
      const sortedMstones = [...milestones].sort((a, b) => a - b);
      for (const milestone of sortedMstones) {
        if (pct >= milestone) {
          await createNotification(
            userId, NOTIFICATION_TYPES.GOAL_MILESTONE,
            milestone === 100 ? `🎉 Goal Reached: ${goal.title}` : `${milestone}% Milestone: ${goal.title}`,
            milestone === 100
              ? `Congratulations! You've reached your savings goal of ${currency} ${target.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`
              : `You've saved ${milestone}% toward "${goal.title}". Keep it up!`,
            { goal_id: goal.id, milestone, saved, target },
            `goal_milestone_${goal.id}_${milestone}`,
            true
          );
        }
      }
    }

    if (deadlineEnabled && goal.target_date) {
      const due = new Date(goal.target_date);
      const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff <= daysBefore && pct < 100) {
        const remaining = target - saved;
        await createNotification(
          userId, NOTIFICATION_TYPES.GOAL_DEADLINE,
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
  const threshold = (prefs[NOTIFICATION_TYPES.SPENDING_SPIKE]?.threshold ?? 30) / 100;
  const now = new Date();
  const curStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prvStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const prvEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const db = getDb();
  const curTxs = await db.getAllAsync(
    "SELECT amount FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ?",
    [userId, curStart]
  );
  const prvTxs = await db.getAllAsync(
    "SELECT amount FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?",
    [userId, prvStart, prvEnd]
  );

  const cur = curTxs.reduce((s, t) => s + parseFloat(t.amount), 0);
  const prv = prvTxs.reduce((s, t) => s + parseFloat(t.amount), 0);

  if (prv > 0 && (cur - prv) / prv > threshold) {
    const pct = (((cur - prv) / prv) * 100).toFixed(0);
      await createNotification(
        userId, NOTIFICATION_TYPES.SPENDING_SPIKE,
        'Spending Spike Detected',
        `Your spending this month is ${pct}% higher than last month. ${currency} ${cur.toLocaleString(undefined, { maximumFractionDigits: 0 })} spent so far.`,
        { current: cur, previous: prv, increase_pct: pct },
        `spending_spike_${periodKey}`,
        true
      );
  }
};

const checkNegativeBalance = async (userId, prefs, currency) => {
  if (!prefs[NOTIFICATION_TYPES.NEGATIVE_BALANCE]?.enabled) return;
  const db = getDb();
  const txs = await db.getAllAsync('SELECT amount, type FROM transactions WHERE user_id = ?', [userId]);
  if (!txs?.length) return;
  const balance = txs.reduce((s, t) => s + (t.type === 'income' ? 1 : -1) * parseFloat(t.amount), 0);
  if (balance < 0) {
    const periodKey = new Date().toISOString().split('T')[0];
    await createNotification(
      userId, NOTIFICATION_TYPES.NEGATIVE_BALANCE,
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

  const db = getDb();
  const txs = await db.getAllAsync(
    "SELECT t.id, t.title, t.amount, t.category_id, c.name AS cat_name FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.amount >= ?",
    [userId, yesterday, threshold]
  );
  if (!txs?.length) return;

  for (const t of txs) {
      await createNotification(
        userId, NOTIFICATION_TYPES.LARGE_TRANSACTION,
        `Large Expense: ${t.title || 'Transaction'}`,
        `A ${t.cat_name || 'expense'} of ${currency} ${parseFloat(t.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })} was recorded.`,
        { transaction_id: t.id, amount: t.amount },
        `large_tx_${t.id}`,
        true
      );
  }
};

const checkLoanReminders = async (userId, prefs, currency) => {
  const dueEnabled = prefs[NOTIFICATION_TYPES.LOAN_DUE]?.enabled;
  const overdueEnabled = prefs[NOTIFICATION_TYPES.LOAN_OVERDUE]?.enabled;
  if (!dueEnabled && !overdueEnabled) return;

  const daysBefore = prefs[NOTIFICATION_TYPES.LOAN_DUE]?.daysBefore ?? 3;
  const db = getDb();
  const now = new Date();

  // Check single-date loans
  const loans = await db.getAllAsync(
    'SELECT * FROM loans WHERE user_id = ? AND is_settled = 0 ORDER BY due_date ASC',
    [userId]
  );

  if (loans?.length) {
    for (const loan of loans) {
      if (loan.due_date) {
        const dueDate = new Date(loan.due_date);
        const diff = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

        if (overdueEnabled && diff < 0) {
          // Overdue
          const daysOverdue = Math.abs(diff);
          await createNotification(
            userId, NOTIFICATION_TYPES.LOAN_OVERDUE,
            `⚠️ Overdue Loan: ${loan.person_name}`,
            `${loan.type === 'given' ? 'Loan to' : 'Loan from'} ${loan.person_name} was due ${daysOverdue} days ago. ${currency} ${parseFloat(loan.total_amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
            { loan_id: loan.id, person_name: loan.person_name, amount: loan.total_amount },
            `loan_overdue_${loan.id}_${dueDate.toISOString().split('T')[0]}`,
            true
          );
        } else if (dueEnabled && diff >= 0 && diff <= daysBefore) {
          // Due soon
          const dueLabel = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : `in ${diff} days`;
          await createNotification(
            userId, NOTIFICATION_TYPES.LOAN_DUE,
            `Loan Due: ${loan.person_name}`,
            `${loan.type === 'given' ? 'Loan to' : 'Loan from'} ${loan.person_name} is due ${dueLabel}. ${currency} ${parseFloat(loan.total_amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
            { loan_id: loan.id, person_name: loan.person_name, amount: loan.total_amount },
            `loan_due_${loan.id}_${dueDate.toISOString().split('T')[0]}`,
            true
          );
        }
      }
    }
  }

  // Check multi-installment loan payments
  const payments = await db.getAllAsync(
    `SELECT lp.*, l.person_name, l.type, l.total_amount, l.user_id 
     FROM loan_payments lp
     JOIN loans l ON l.id = lp.loan_id
     WHERE l.user_id = ? AND lp.is_paid = 0 AND lp.due_date IS NOT NULL
     ORDER BY lp.due_date ASC`,
    [userId]
  );

  if (payments?.length) {
    for (const payment of payments) {
      if (payment.due_date) {
        const dueDate = new Date(payment.due_date);
        const diff = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

        if (overdueEnabled && diff < 0) {
          // Overdue
          const daysOverdue = Math.abs(diff);
          await createNotification(
            userId, NOTIFICATION_TYPES.LOAN_OVERDUE,
            `⚠️ Overdue Installment: ${payment.person_name}`,
            `Installment payment to ${payment.person_name} was due ${daysOverdue} days ago. ${currency} ${parseFloat(payment.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
            { loan_id: payment.loan_id, payment_id: payment.id, person_name: payment.person_name, amount: payment.amount },
            `loan_installment_overdue_${payment.id}_${dueDate.toISOString().split('T')[0]}`,
            true
          );
        } else if (dueEnabled && diff >= 0 && diff <= daysBefore) {
          // Due soon
          const dueLabel = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : `in ${diff} days`;
          await createNotification(
            userId, NOTIFICATION_TYPES.LOAN_DUE,
            `Installment Due: ${payment.person_name}`,
            `Installment payment to ${payment.person_name} is due ${dueLabel}. ${currency} ${parseFloat(payment.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
            { loan_id: payment.loan_id, payment_id: payment.id, person_name: payment.person_name, amount: payment.amount },
            `loan_installment_due_${payment.id}_${dueDate.toISOString().split('T')[0]}`,
            true
          );
        }
      }
    }
  }
};

export const generateNotifications = async (userId) => {
  try {
    const db = getDb();
    const row = await db.getFirstAsync('SELECT currency FROM users WHERE id = ?', [userId]);
    const currency = row?.currency || 'PKR';
    const prefs = await getPreferences(userId);

    await Promise.all([
      checkPlannedPayments(userId, prefs, currency),
      checkBudgets(userId, prefs, currency),
      checkSavingsGoals(userId, prefs, currency),
      checkSpendingSpike(userId, prefs, currency),
      checkNegativeBalance(userId, prefs, currency),
      checkLargeTransactions(userId, prefs, currency),
      checkLoanReminders(userId, prefs, currency),
    ]);

    // Auto-archive notifications older than 30 days
    await archiveOldNotifications(userId);
  } catch (e) {
    console.warn('generateNotifications error:', e.message);
  }
};
