import { getDb, generateId } from '../lib/db';

export const formatLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseLocalDate = (dateString) => {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

export const getRelatedCategoryIds = (categoryId, allCategories) => {
  const children = (allCategories || [])
    .filter(c => c.parent_id === categoryId)
    .map(c => c.id);
  return [categoryId, ...children];
};

export const getActivePeriod = (startDate, frequency) => {
  const now   = new Date();
  const start = parseLocalDate(startDate);

  if (frequency === 'once' || !frequency) return { start: startDate, end: null };

  let periodStart = new Date(start);
  while (true) {
    let next;
    if      (frequency === 'daily')   { next = new Date(periodStart); next.setDate(next.getDate() + 1); }
    else if (frequency === 'weekly')  { next = new Date(periodStart); next.setDate(next.getDate() + 7); }
    else if (frequency === 'monthly') { next = new Date(periodStart); next.setMonth(next.getMonth() + 1); }
    else if (frequency === 'yearly')  { next = new Date(periodStart); next.setFullYear(next.getFullYear() + 1); }
    else break;
    if (next > now) break;
    periodStart = next;
  }

  let periodEnd;
  if      (frequency === 'daily')   { periodEnd = new Date(periodStart); periodEnd.setDate(periodEnd.getDate() + 1); }
  else if (frequency === 'weekly')  { periodEnd = new Date(periodStart); periodEnd.setDate(periodEnd.getDate() + 7); }
  else if (frequency === 'monthly') { periodEnd = new Date(periodStart); periodEnd.setMonth(periodEnd.getMonth() + 1); }
  else if (frequency === 'yearly')  { periodEnd = new Date(periodStart); periodEnd.setFullYear(periodEnd.getFullYear() + 1); }

  periodEnd.setMilliseconds(periodEnd.getMilliseconds() - 1);
  return { start: formatLocalDate(periodStart), end: formatLocalDate(periodEnd) };
};

export const decodeBudget = (b) => {
  try {
    const config = JSON.parse(b.period);
    return { ...b, start_date: config.s, end_date: config.e, frequency: config.f, period: config.p };
  } catch {
    const [y, m] = (b.period || '').split('-').map(Number);
    const start  = (y && m)
      ? formatLocalDate(new Date(y, m - 1, 1))
      : formatLocalDate(new Date(b.created_at));
    return { ...b, start_date: start, end_date: null, frequency: 'monthly' };
  }
};

export const budgetService = {
  async getBudgets(userId) {
    const db = getDb();

    const budgets = await db.getAllAsync(
      'SELECT * FROM budgets WHERE user_id = ?',
      [userId]
    );

    const categories = await db.getAllAsync(
      'SELECT id, name, icon, color, type FROM categories WHERE user_id = ? OR user_id IS NULL',
      [userId]
    );
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

    const data = budgets.map(b => ({ ...b, categories: catMap[b.category_id] || null }));
    return { data };
  },

  async saveBudget(userId, budgetData, existingId = null) {
    const db = getDb();
    const id = existingId || budgetData.id || generateId();

    const encodedConfig = JSON.stringify({
      s: budgetData.start_date,
      e: budgetData.end_date,
      f: budgetData.frequency,
      p: budgetData.period,
    });

    if (existingId) {
      await db.runAsync(
        'UPDATE budgets SET category_id = ?, total_amount = ?, period = ? WHERE id = ?',
        [budgetData.category_id, Number(budgetData.total_amount), encodedConfig, existingId]
      );
    } else {
      await db.runAsync(
        `INSERT INTO budgets (id, user_id, category_id, total_amount, period, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, userId, budgetData.category_id, Number(budgetData.total_amount),
         encodedConfig, budgetData.created_at || new Date().toISOString()]
      );
    }
    return { id };
  },

  async deleteBudget(userId, id) {
    const db = getDb();
    await db.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
    return { id };
  },
};

export default budgetService;
