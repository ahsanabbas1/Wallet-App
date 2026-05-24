import { getDb, generateId } from '../lib/db';

function buildDateClause(options = {}) {
  const { period = 'ALL', customStartDate, customEndDate } = options;
  if (period === 'ALL') return { clause: '', params: [] };

  const now   = new Date();
  let   start = null;

  if      (period === 'TODAY')  { start = new Date(); start.setHours(0, 0, 0, 0); }
  else if (period === '1W')     { start = new Date(); start.setDate(now.getDate() - 7); }
  else if (period === '1M')     { start = new Date(); start.setMonth(now.getMonth() - 1); }
  else if (period === '6M')     { start = new Date(); start.setMonth(now.getMonth() - 6); }
  else if (period === '1Y')     { start = new Date(); start.setFullYear(now.getFullYear() - 1); }
  else if (period === 'CUSTOM' && customStartDate) { start = new Date(customStartDate); }

  const parts  = [];
  const params = [];

  if (start) { parts.push('date >= ?'); params.push(start.toISOString()); }

  if (period === 'CUSTOM' && customEndDate) {
    const end = new Date(customEndDate);
    end.setHours(23, 59, 59, 999);
    parts.push('date <= ?');
    params.push(end.toISOString());
  }

  return { clause: parts.length ? ` AND ${parts.join(' AND ')}` : '', params };
}

export const transactionService = {
  async initialize() {},

  async getCategories(userId) {
    const db = getDb();
    return db.getAllAsync(
      `SELECT id, user_id, parent_id, name, icon, color, type, created_at
       FROM categories
       WHERE user_id = ? OR user_id IS NULL
       ORDER BY name ASC`,
      [userId]
    );
  },

  async getTransactions(userId, options = {}) {
    const db = getDb();
    const { clause, params } = buildDateClause(options);

    const transactions = await db.getAllAsync(
      `SELECT * FROM transactions WHERE user_id = ?${clause} ORDER BY date DESC`,
      [userId, ...params]
    );

    // Attach category objects manually (mirrors the Supabase join shape)
    const categories = await db.getAllAsync(
      'SELECT * FROM categories WHERE user_id = ? OR user_id IS NULL',
      [userId]
    );
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
    const data   = transactions.map(t => ({ ...t, categories: catMap[t.category_id] || null }));

    return { data };
  },

  async addTransaction(transactionData) {
    const db = getDb();
    const id = transactionData.id || generateId();
    await db.runAsync(
      `INSERT INTO transactions (id, user_id, category_id, amount, type, title, description, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        transactionData.user_id,
        transactionData.category_id ?? null,
        Number(transactionData.amount),
        transactionData.type,
        transactionData.title ?? null,
        transactionData.description ?? null,
        transactionData.date,
        transactionData.created_at || transactionData.date || new Date().toISOString(),
      ]
    );
    return { id };
  },

  async updateTransaction(id, transactionData) {
    const db = getDb();
    await db.runAsync(
      `UPDATE transactions
       SET category_id = ?, amount = ?, type = ?, title = ?, description = ?, date = ?
       WHERE id = ?`,
      [
        transactionData.category_id ?? null,
        Number(transactionData.amount),
        transactionData.type,
        transactionData.title,
        transactionData.description ?? null,
        transactionData.date,
        id,
      ]
    );
    return { id };
  },

  async deleteTransaction(userId, id) {
    const db = getDb();
    await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
    return { id };
  },
};

export default transactionService;
