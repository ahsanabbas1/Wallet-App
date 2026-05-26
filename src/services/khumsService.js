import { getDb } from '../lib/db';
import { accountService } from './accountService';

async function ensureColumn(db, table, column, definition) {
  const cols = await db.getAllAsync(`PRAGMA table_info(${table})`);
  if (!cols?.some?.(col => col.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

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

function yearStartFromDue(dueDateISO) {
  const d = new Date(dueDateISO);
  d.setFullYear(d.getFullYear() - 1);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function yearEndFromDue(dueDateISO) {
  return new Date(dueDateISO).toISOString();
}

/* ─────────────────────────────────────────────────────────────────────────────
   PURE CALCULATION ENGINE
   No DB access — fully portable and testable.

   RULES (Ayatollah Sistani):
   ① Multiplier: Khums = 1/5 of surplus → gross threshold = lastYearKhumsPaid × 5
   ② Dynamic wealth: tax is levied only on growth above the already-cleared threshold
   ③ Deferred receivables: outstanding loan principal is excluded from the taxable pool;
      installments already received are in the live balance and get taxed normally
   ④ 50/50 split: Sahm-e-Imam and Sahm-e-Sadat each receive half of Khums Due
───────────────────────────────────────────────────────────────────────────── */
export function calculateLedgerKhums(
  currentYearTotalWealth,
  lastYearKhumsPaid,
  deferredReceivables = 0,
) {
  const wealth   = Math.max(0, Number(currentYearTotalWealth) || 0);
  const paid     = Math.max(0, Number(lastYearKhumsPaid)      || 0);
  const deferred = Math.max(0, Number(deferredReceivables)    || 0);

  // ① Reconstruct the gross wealth pool that was already taxed last year.
  //    Khums = 20% = 1/5, so if 50k was paid, the taxed pool was 50k × 5 = 250k.
  const lastYearGrossThreshold = paid * 5;

  // ③ Remove the outstanding unrecovered loan principal from the taxable pool.
  //    Installments already received are already reflected in `wealth` (they sit
  //    in the active bank balance) and are therefore taxed normally.
  const effectiveWealth = wealth - deferred;

  // ② Only the portion of effective wealth that exceeds last year's threshold
  //    represents truly new savings — that is the taxable base.
  const newTaxableSavings = effectiveWealth - lastYearGrossThreshold;

  const khumsDue  = Math.max(0, newTaxableSavings) * 0.20;

  // ④ Equal split between the two shares
  const sahmImam  = khumsDue / 2;
  const sahmSadat = khumsDue / 2;

  return {
    currentYearTotalWealth: wealth,
    deferredReceivables:    deferred,
    effectiveWealth,
    lastYearKhumsPaid:      paid,
    lastYearGrossThreshold,
    newTaxableSavings,
    isKhumsDue: khumsDue > 0,
    khumsDue,
    sahmImam,
    sahmSadat,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   SERVICE LAYER
───────────────────────────────────────────────────────────────────────────── */
export const khumsService = {

  /* ── Khums Years ─────────────────────────────────────────────────────── */

  async getYears(userId) {
    const db = getDb();
    // Ensure new columns exist before reading (idempotent)
    await ensureColumn(db, 'khums_years', 'last_khums_paid', 'REAL DEFAULT 0');
    await ensureColumn(db, 'khums_years', 'current_wealth',  'REAL DEFAULT 0');
    return db.getAllAsync(
      'SELECT * FROM khums_years WHERE user_id = ? ORDER BY year_start DESC',
      [userId]
    );
  },

  async createYear(userId, dueDateISO) {
    const db  = getDb();
    const id  = uuid();
    const now = new Date().toISOString();
    await ensureColumn(db, 'khums_years', 'last_khums_paid', 'REAL DEFAULT 0');
    await ensureColumn(db, 'khums_years', 'current_wealth',  'REAL DEFAULT 0');

    const yearStart = yearStartFromDue(dueDateISO);
    const yearEnd   = yearEndFromDue(dueDateISO);
    const yearLabel = makeYearLabel(yearStart);

    await db.runAsync(
      `INSERT INTO khums_years
         (id, user_id, year_label, year_start, year_end,
          income_auto, income_extra, income_exempt, income_receivable,
          last_khums_paid, current_wealth,
          expenses_total, surplus, khums_due, sahm_imam, sahm_sadat,
          paid_imam, paid_sadat, status, notes, created_at)
       VALUES (?,?,?,?,?, 0,0,0,0, 0,0, 0,0,0,0,0, 0,0,'open',NULL,?)`,
      [id, userId, yearLabel, yearStart, yearEnd, now]
    );
    return id;
  },

  async updateYear(id, data) {
    const db   = getDb();
    const sets = [];
    const vals = [];
    if (data.last_khums_paid  !== undefined) { sets.push('last_khums_paid = ?');  vals.push(Number(data.last_khums_paid)); }
    if (data.income_receivable !== undefined) { sets.push('income_receivable = ?'); vals.push(Number(data.income_receivable)); }
    if (data.current_wealth   !== undefined) { sets.push('current_wealth = ?');   vals.push(Number(data.current_wealth)); }
    if (data.notes            !== undefined) { sets.push('notes = ?');            vals.push(data.notes); }
    if (!sets.length) return;
    vals.push(id);
    await db.runAsync(`UPDATE khums_years SET ${sets.join(', ')} WHERE id = ?`, vals);
    await khumsService.recalculate(id);
  },

  /* ── Core recalculation — runs after any input change ───────────────── */

  async recalculate(id) {
    const db  = getDb();
    const row = await db.getFirstAsync('SELECT * FROM khums_years WHERE id = ?', [id]);
    if (!row) return;

    const calc = calculateLedgerKhums(
      row.current_wealth    ?? 0,
      row.last_khums_paid   ?? 0,
      row.income_receivable ?? 0,
    );

    const [paidImamRow, paidSadatRow] = await Promise.all([
      db.getFirstAsync(
        "SELECT COALESCE(SUM(amount),0) as total FROM khums_payments WHERE khums_year_id = ? AND recipient_type = 'sahm_imam'",
        [id]
      ),
      db.getFirstAsync(
        "SELECT COALESCE(SUM(amount),0) as total FROM khums_payments WHERE khums_year_id = ? AND recipient_type = 'sahm_sadat'",
        [id]
      ),
    ]);

    const paidImam  = Number(paidImamRow?.total  ?? 0);
    const paidSadat = Number(paidSadatRow?.total ?? 0);
    const totalPaid = paidImam + paidSadat;

    let status = 'open';
    if (calc.khumsDue > 0 && totalPaid >= calc.khumsDue) status = 'settled';
    else if (totalPaid > 0)                               status = 'partial';

    await db.runAsync(
      `UPDATE khums_years
         SET surplus    = ?,
             khums_due  = ?,
             sahm_imam  = ?,
             sahm_sadat = ?,
             paid_imam  = ?,
             paid_sadat = ?,
             status     = ?
       WHERE id = ?`,
      [
        calc.newTaxableSavings,
        calc.khumsDue,
        calc.sahmImam,
        calc.sahmSadat,
        paidImam,
        paidSadat,
        status,
        id,
      ]
    );
  },

  /* ── Sync live account balance, then recalculate ────────────────────── */

  async refreshAutoData(khumsYearId) {
    const db = getDb();
    const yr = await db.getFirstAsync('SELECT * FROM khums_years WHERE id = ?', [khumsYearId]);
    if (!yr) return { currentWealth: 0 };

    // "Current Year Total Wealth" = live sum of all active account balances.
    // This figure naturally rises/falls as the user earns, spends, and receives
    // loan repayment installments — no manual income/expense tally is needed.
    const currentWealth = await accountService.getTotalBalance(yr.user_id);

    await db.runAsync(
      'UPDATE khums_years SET current_wealth = ? WHERE id = ?',
      [currentWealth, khumsYearId]
    );

    await khumsService.recalculate(khumsYearId);
    return { currentWealth };
  },

  async deleteYear(id) {
    const db = getDb();
    await db.runAsync('DELETE FROM khums_payments WHERE khums_year_id = ?', [id]);
    await db.runAsync('DELETE FROM khums_expenses  WHERE khums_year_id = ?', [id]);
    await db.runAsync('DELETE FROM khums_years     WHERE id = ?', [id]);
  },

  /* ── Payments ────────────────────────────────────────────────────────── */

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

  /* ── Previous Khums History (reference records) ─────────────────────── */

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
