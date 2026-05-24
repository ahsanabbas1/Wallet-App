import { getDb, generateId } from '../lib/db';

export const accountService = {
  async getAccounts(userId) {
    const db = getDb();
    return db.getAllAsync(
      'SELECT * FROM accounts WHERE user_id = ? AND is_active = 1 ORDER BY created_at ASC',
      [userId]
    );
  },

  async getAccountsWithStats(userId) {
    const db = getDb();
    const accounts = await db.getAllAsync(
      'SELECT * FROM accounts WHERE user_id = ? AND is_active = 1 ORDER BY created_at ASC',
      [userId]
    );

    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const stats = await db.getAllAsync(
      `SELECT
         account_id,
         SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS monthly_spent,
         SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS monthly_received,
         COUNT(*) AS monthly_tx_count
       FROM transactions
       WHERE user_id = ? AND account_id IS NOT NULL AND date >= ?
       GROUP BY account_id`,
      [userId, monthStart]
    );

    const statsMap = Object.fromEntries(stats.map(s => [s.account_id, s]));

    return accounts.map(a => ({
      ...a,
      monthly_spent:    statsMap[a.id]?.monthly_spent    ?? 0,
      monthly_received: statsMap[a.id]?.monthly_received ?? 0,
      monthly_tx_count: statsMap[a.id]?.monthly_tx_count ?? 0,
    }));
  },

  async saveAccount(userId, data, isNew) {
    const db  = getDb();
    const now = new Date().toISOString();
    if (isNew) {
      const id = generateId();
      await db.runAsync(
        'INSERT INTO accounts (id, user_id, bank_name, account_name, account_type, balance, color, icon, is_active, created_at) VALUES (?,?,?,?,?,?,?,?,1,?)',
        [id, userId, data.bank_name || '', data.account_name, data.account_type, data.balance, data.color, data.icon, now]
      );
      return id;
    } else {
      await db.runAsync(
        'UPDATE accounts SET bank_name=?, account_name=?, account_type=?, balance=?, color=?, icon=? WHERE id=?',
        [data.bank_name || '', data.account_name, data.account_type, data.balance, data.color, data.icon, data.id]
      );
      return data.id;
    }
  },

  async deleteAccount(id) {
    const db = getDb();
    await db.runAsync('UPDATE accounts SET is_active = 0 WHERE id = ?', [id]);
  },

  // delta is positive to add money, negative to deduct
  async adjustBalance(accountId, delta) {
    if (!accountId || delta === 0) return;
    const db = getDb();
    await db.runAsync(
      'UPDATE accounts SET balance = balance + ? WHERE id = ?',
      [delta, accountId]
    );
  },

  async getTotalBalance(userId) {
    const db  = getDb();
    const row = await db.getFirstAsync(
      'SELECT SUM(balance) as total FROM accounts WHERE user_id = ? AND is_active = 1',
      [userId]
    );
    return row?.total ?? 0;
  },
};
