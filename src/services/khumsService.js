import { getDb } from '../lib/db';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function makeYearLabel(startISO) {
  const s = new Date(startISO);
  const e = new Date(startISO);
  e.setFullYear(e.getFullYear() + 1);
  e.setDate(e.getDate() - 1);
  const sy = s.getFullYear();
  const ey = e.getFullYear();
  return sy === ey ? String(sy) : `${sy}–${String(ey).slice(2)}`;
}

// Due date → year_start = (due − 1 year) + 1 day, year_end = due
// Per Sistani: Khums year begins the day AFTER the previous payment
// and ends ON the next due date (the same calendar date each year).
function yearStartFromDue(dueDateISO) {
  const d = new Date(dueDateISO);
  d.setFullYear(d.getFullYear() - 1); // go back one year (to last payment date)
  d.setDate(d.getDate() + 1);         // then +1 day: year starts the day after last payment
  return d.toISOString();
}

function yearEndFromDue(dueDateISO) {
  // The year ends ON the due date itself (not the day before)
  return new Date(dueDateISO).toISOString();
}

export const khumsService = {
  /* ── Khums Years ────────────────────────────────────────────────── */

  async getYears(userId) {
    const db = getDb();
    return db.getAllAsync(
      'SELECT * FROM khums_years WHERE user_id = ? ORDER BY year_start DESC',
      [userId]
    );
  },

  async createYear(userId, dueDateISO) {
    const db        = getDb();
    const id        = uuid();
    const now       = new Date().toISOString();
    const yearStart = yearStartFromDue(dueDateISO);
    const yearEnd   = yearEndFromDue(dueDateISO);
    const yearLabel = makeYearLabel(yearStart);

    await db.runAsync(
      `INSERT INTO khums_years
         (id, user_id, year_label, year_start, year_end, income_auto, income_extra,
          income_exempt, expenses_total, surplus, khums_due, sahm_imam, sahm_sadat,
          paid_imam, paid_sadat, status, notes, created_at)
       VALUES (?,?,?,?,?,0,0,0,0,0,0,0,0,0,0,'open',NULL,?)`,
      [id, userId, yearLabel, yearStart, yearEnd, now]
    );
    return id;
  },

  async updateYear(id, data) {
    const db = getDb();
    const sets = [];
    const vals = [];
    if (data.income_extra       !== undefined) { sets.push('income_extra = ?');       vals.push(Number(data.income_extra)); }
    if (data.income_exempt      !== undefined) { sets.push('income_exempt = ?');      vals.push(Number(data.income_exempt)); }
    if (data.income_receivable  !== undefined) { sets.push('income_receivable = ?');  vals.push(Number(data.income_receivable)); }
    if (data.notes              !== undefined) { sets.push('notes = ?');              vals.push(data.notes); }
    if (!sets.length) return;
    vals.push(id);
    await db.runAsync(`UPDATE khums_years SET ${sets.join(', ')} WHERE id = ?`, vals);
    await khumsService.recalculate(id);
  },

  async recalculate(id) {
    const db  = getDb();
    const row = await db.getFirstAsync('SELECT * FROM khums_years WHERE id = ?', [id]);
    if (!row) return;

    // Manual expense entries (user-added extras not in transactions)
    const manualExpRow = await db.getFirstAsync(
      'SELECT COALESCE(SUM(amount),0) as total FROM khums_expenses WHERE khums_year_id = ?', [id]
    );
    const manualExp  = Number(manualExpRow?.total ?? 0);
    const expAutoVal = Number(row.expenses_auto ?? 0);
    const expTotal   = expAutoVal + manualExp;

    const surplus  = Math.max(0,
      (Number(row.income_auto) + Number(row.income_extra) + Number(row.income_receivable ?? 0) - Number(row.income_exempt)) - expTotal
    );
    const khumsDue  = surplus * 0.20;
    const sahmImam  = khumsDue / 2;
    const sahmSadat = khumsDue / 2;

    const paidImamRow = await db.getFirstAsync(
      "SELECT COALESCE(SUM(amount),0) as total FROM khums_payments WHERE khums_year_id = ? AND recipient_type = 'sahm_imam'", [id]
    );
    const paidSadatRow = await db.getFirstAsync(
      "SELECT COALESCE(SUM(amount),0) as total FROM khums_payments WHERE khums_year_id = ? AND recipient_type = 'sahm_sadat'", [id]
    );

    const paidImam  = Number(paidImamRow?.total  ?? 0);
    const paidSadat = Number(paidSadatRow?.total ?? 0);
    const totalPaid = paidImam + paidSadat;

    let status = 'open';
    if (khumsDue > 0 && totalPaid >= khumsDue)  status = 'settled';
    else if (totalPaid > 0)                      status = 'partial';

    await db.runAsync(
      `UPDATE khums_years
         SET expenses_total = ?, surplus = ?, khums_due = ?,
             sahm_imam = ?, sahm_sadat = ?,
             paid_imam = ?, paid_sadat = ?, status = ?
       WHERE id = ?`,
      [expTotal, surplus, khumsDue, sahmImam, sahmSadat, paidImam, paidSadat, status, id]
    );
  },

  async deleteYear(id) {
    const db = getDb();
    await db.runAsync('DELETE FROM khums_payments WHERE khums_year_id = ?', [id]);
    await db.runAsync('DELETE FROM khums_expenses  WHERE khums_year_id = ?', [id]);
    await db.runAsync('DELETE FROM khums_years     WHERE id = ?', [id]);
  },

  /* ── Auto sync from transactions (income + expenses) ────────────── */

  async pullIncomeFromTransactions(userId, yearStart, yearEnd) {
    const db  = getDb();
    // Use date() to normalize both sides — handles ISO timestamps, date-only strings, and timezone offsets
    const row = await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
        WHERE user_id = ?
          AND type = 'income'
          AND date(date) >= date(?)
          AND date(date) <= date(?)`,
      [userId, yearStart, yearEnd]
    );
    return Number(row?.total ?? 0);
  },

  async pullExpensesFromTransactions(userId, yearStart, yearEnd) {
    const db  = getDb();
    const row = await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
        WHERE user_id = ?
          AND type = 'expense'
          AND date(date) >= date(?)
          AND date(date) <= date(?)`,
      [userId, yearStart, yearEnd]
    );
    return Number(row?.total ?? 0);
  },

  // Syncs income_auto + expenses_auto from transactions, then fully recalculates in one UPDATE
  async refreshAutoData(khumsYearId) {
    const db  = getDb();
    const yr  = await db.getFirstAsync('SELECT * FROM khums_years WHERE id = ?', [khumsYearId]);
    if (!yr) return { income: 0, expenses: 0, yearStart: null, effectiveEnd: null, txCount: 0 };

    // Cap end at today for mid-year syncs
    const today        = new Date().toISOString();
    const effectiveEnd = yr.year_end < today ? yr.year_end : today;

    const [income, expensesAuto, countRow, manualExpRow, paidImamRow, paidSadatRow] =
      await Promise.all([
        khumsService.pullIncomeFromTransactions(yr.user_id, yr.year_start, effectiveEnd),
        khumsService.pullExpensesFromTransactions(yr.user_id, yr.year_start, effectiveEnd),
        db.getFirstAsync(
          `SELECT COUNT(*) as cnt FROM transactions
            WHERE user_id = ? AND date(date) >= date(?) AND date(date) <= date(?)`,
          [yr.user_id, yr.year_start, effectiveEnd]
        ),
        db.getFirstAsync(
          'SELECT COALESCE(SUM(amount),0) as total FROM khums_expenses WHERE khums_year_id = ?',
          [khumsYearId]
        ),
        db.getFirstAsync(
          `SELECT COALESCE(SUM(amount),0) as total FROM khums_payments
            WHERE khums_year_id = ? AND recipient_type = 'sahm_imam'`,
          [khumsYearId]
        ),
        db.getFirstAsync(
          `SELECT COALESCE(SUM(amount),0) as total FROM khums_payments
            WHERE khums_year_id = ? AND recipient_type = 'sahm_sadat'`,
          [khumsYearId]
        ),
      ]);

    const manualExp  = Number(manualExpRow?.total  ?? 0);
    const paidImam   = Number(paidImamRow?.total   ?? 0);
    const paidSadat  = Number(paidSadatRow?.total  ?? 0);
    const expTotal   = expensesAuto + manualExp;

    const surplus   = Math.max(0,
      (income + Number(yr.income_extra) + Number(yr.income_receivable ?? 0) - Number(yr.income_exempt)) - expTotal
    );
    const khumsDue  = surplus * 0.20;
    const sahmImam  = khumsDue / 2;
    const sahmSadat = khumsDue / 2;
    const totalPaid = paidImam + paidSadat;

    let status = 'open';
    if (khumsDue > 0 && totalPaid >= khumsDue) status = 'settled';
    else if (totalPaid > 0)                    status = 'partial';

    // Single UPDATE — no second read needed, avoids any stale-cache issues
    await db.runAsync(
      `UPDATE khums_years
         SET income_auto = ?, expenses_auto = ?, expenses_total = ?,
             surplus = ?, khums_due = ?,
             sahm_imam = ?, sahm_sadat = ?,
             paid_imam = ?, paid_sadat = ?, status = ?
       WHERE id = ?`,
      [income, expensesAuto, expTotal, surplus, khumsDue,
       sahmImam, sahmSadat, paidImam, paidSadat, status, khumsYearId]
    );

    return {
      income,
      expenses: expensesAuto,
      yearStart: yr.year_start,
      effectiveEnd,
      txCount: Number(countRow?.cnt ?? 0),
    };
  },

  /* ── Expenses ───────────────────────────────────────────────────── */

  async getExpenses(khumsYearId) {
    const db = getDb();
    return db.getAllAsync(
      'SELECT * FROM khums_expenses WHERE khums_year_id = ? ORDER BY created_at DESC',
      [khumsYearId]
    );
  },

  async addExpense(userId, khumsYearId, data) {
    const db  = getDb();
    const id  = uuid();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO khums_expenses (id, user_id, khums_year_id, category, amount, description, created_at) VALUES (?,?,?,?,?,?,?)',
      [id, userId, khumsYearId, data.category, Number(data.amount), data.description ?? null, now]
    );
    await khumsService.recalculate(khumsYearId);
    return id;
  },

  async deleteExpense(id, khumsYearId) {
    const db = getDb();
    await db.runAsync('DELETE FROM khums_expenses WHERE id = ?', [id]);
    await khumsService.recalculate(khumsYearId);
  },

  /* ── Payments ───────────────────────────────────────────────────── */

  async getPayments(khumsYearId) {
    const db = getDb();
    return db.getAllAsync(
      'SELECT * FROM khums_payments WHERE khums_year_id = ? ORDER BY date DESC',
      [khumsYearId]
    );
  },

  async addPayment(userId, khumsYearId, data) {
    const db  = getDb();
    const id  = uuid();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO khums_payments (id, user_id, khums_year_id, recipient_type, recipient_name, amount, date, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, userId, khumsYearId, data.recipient_type, data.recipient_name ?? null,
       Number(data.amount), data.date ?? now, data.notes ?? null, now]
    );
    await khumsService.recalculate(khumsYearId);
    return id;
  },

  async deletePayment(id, khumsYearId) {
    const db = getDb();
    await db.runAsync('DELETE FROM khums_payments WHERE id = ?', [id]);
    await khumsService.recalculate(khumsYearId);
  },

  /* ── Previous Khums History (reference records) ──────────────────── */

  async getHistory(userId) {
    const db = getDb();
    return db.getAllAsync(
      'SELECT * FROM khums_history WHERE user_id = ? ORDER BY payment_date DESC',
      [userId]
    );
  },

  async addHistory(userId, data) {
    const db  = getDb();
    const id  = uuid();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO khums_history (id, user_id, payment_date, amount, notes, created_at) VALUES (?,?,?,?,?,?)',
      [id, userId, data.payment_date, Number(data.amount), data.notes ?? null, now]
    );
    return id;
  },

  async deleteHistory(id) {
    const db = getDb();
    await db.runAsync('DELETE FROM khums_history WHERE id = ?', [id]);
  },
};
