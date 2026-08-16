import { getDb, generateId } from '../lib/db';
import { accountService } from './accountService';
import { transactionService } from './transactionService';

// Backfill window — keeps the initial history chart bounded on large accounts.
// Covers a full year so the "Yearly" period has data to show.
const BACKFILL_DAYS = 366;

// Maps the shared dashboard trend-period keys ('1M'/'6M'/'1Y') to a lookback window
const PERIOD_DAYS = { '1M': 30, '6M': 183, '1Y': 366 };

export const netWorthService = {
  // Idempotent — call on every Dashboard load. Keeps "today"'s row current
  // and never touches past rows.
  async snapshotToday(userId) {
    if (!userId) return;
    const db = getDb();
    const date = new Date().toISOString().split('T')[0];
    const totalBalance = await accountService.getTotalBalance(userId);

    await db.runAsync(
      `INSERT INTO balance_history (id, user_id, date, total_balance, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET total_balance = excluded.total_balance`,
      [generateId(), userId, date, totalBalance, new Date().toISOString()]
    );
  },

  // One-time, only runs while the user has no history yet. Reconstructs past
  // balances by reversing known transaction deltas off today's live total —
  // transfers are self-canceling (source/destination cancel out across the
  // sum of all accounts) so they're excluded from the delta.
  async backfillIfEmpty(userId) {
    if (!userId) return;
    const db = getDb();
    const existing = await db.getFirstAsync(
      'SELECT COUNT(*) as c FROM balance_history WHERE user_id = ?',
      [userId]
    );
    if (existing?.c > 0) return;

    const currentTotal = await accountService.getTotalBalance(userId);
    const { data: transactions } = await transactionService.getTransactions(userId, { period: 'ALL' });

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - BACKFILL_DAYS);
    const windowStartStr = windowStart.toISOString().split('T')[0];

    const relevant = transactions.filter(t =>
      t.account_id && t.type !== 'transfer' && t.date.split('T')[0] >= windowStartStr
    );
    if (relevant.length === 0) return;

    const dates = [...new Set(relevant.map(t => t.date.split('T')[0]))].sort();

    const now = new Date().toISOString();
    for (const date of dates) {
      // Reverse every delta that happened AFTER this date to get the balance
      // as it stood at the end of this date.
      const laterDelta = relevant
        .filter(t => t.date.split('T')[0] > date)
        .reduce((sum, t) => sum + (t.type === 'expense' ? -parseFloat(t.amount) : parseFloat(t.amount)), 0);
      const balanceAtDate = currentTotal - laterDelta;

      await db.runAsync(
        `INSERT INTO balance_history (id, user_id, date, total_balance, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, date) DO NOTHING`,
        [generateId(), userId, date, balanceAtDate, now]
      );
    }
  },

  async getHistory(userId, days = BACKFILL_DAYS) {
    if (!userId) return [];
    const db = getDb();
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString().split('T')[0];

    return db.getAllAsync(
      'SELECT date, total_balance FROM balance_history WHERE user_id = ? AND date >= ? ORDER BY date ASC',
      [userId, startStr]
    );
  },

  // Shaped to match the dashboard's shared Monthly/6 Months/Yearly period:
  // daily points for Monthly, one point per calendar month (its latest
  // snapshot) for 6 Months/Yearly — keeps the chart from getting overcrowded.
  async getHistoryByPeriod(userId, periodKey = '1M') {
    const days = PERIOD_DAYS[periodKey] || 30;
    const rows = await this.getHistory(userId, days);
    if (periodKey === '1M') return rows;

    const monthMap = {};
    rows.forEach(r => {
      const key = r.date.slice(0, 7); // YYYY-MM
      if (!monthMap[key] || r.date > monthMap[key].date) monthMap[key] = r;
    });
    return Object.keys(monthMap).sort().map(k => monthMap[k]);
  },
};

export default netWorthService;
