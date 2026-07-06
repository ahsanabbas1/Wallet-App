import { getDb, generateId } from '../lib/db';
import { accountService } from './accountService';

function parseLocalDate(dateString) {
  if (!dateString) return null;
  if (dateString.includes('T') || dateString.includes(':')) return new Date(dateString);
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days)     { const n = new Date(date); n.setDate(n.getDate() + days);         return n; }
function addMonths(date, months) { const n = new Date(date); n.setMonth(n.getMonth() + months);     return n; }
function addYears(date, years)   { const n = new Date(date); n.setFullYear(n.getFullYear() + years); return n; }

function normalizeFrequency(frequency, customDays) {
  if (frequency === 'custom') return `custom:${Math.max(1, Number(customDays) || 1)}`;
  return frequency;
}

function getFrequencyLabel(frequency) {
  if (!frequency) return 'CUSTOM';
  if (frequency.startsWith('custom:')) {
    const days = Number(frequency.split(':')[1] || 1);
    return `EVERY ${days} DAY${days === 1 ? '' : 'S'}`;
  }
  return frequency.toUpperCase();
}

function getNextOccurrence(dateString, frequency) {
  const base = parseLocalDate(dateString);
  if (!base) return dateString;
  if (frequency === 'daily')   return formatLocalDate(addDays(base, 1));
  if (frequency === 'weekly')  return formatLocalDate(addDays(base, 7));
  if (frequency === 'monthly') return formatLocalDate(addMonths(base, 1));
  if (frequency === 'yearly')  return formatLocalDate(addYears(base, 1));
  if (frequency?.startsWith('custom:')) {
    const days = Math.max(1, Number(frequency.split(':')[1] || 1));
    return formatLocalDate(addDays(base, days));
  }
  return formatLocalDate(addMonths(base, 1));
}

function toTransactionTimestamp(dateString) {
  if (dateString.includes('T')) return dateString;
  return `${dateString}T12:00:00.000`;
}

async function processSinglePlannedPayment(db, item) {
  const now = new Date();
  if (!item.next_date || !item.is_active) return false;

  if (item.end_date) {
    const end = parseLocalDate(item.end_date);
    if (end && now > end) return false;
  }
  if (item.start_date) {
    const start = parseLocalDate(item.start_date);
    if (start && now < start) return false;
  }

  const nextDue = new Date(item.next_date);
  if (isNaN(nextDue.getTime()) || nextDue > now) return false;

  // Compute the new next_date before touching the DB
  const nextOccurrence = getNextOccurrence(item.next_date.split('T')[0], item.frequency);
  const timePart       = item.next_date.includes('T') ? item.next_date.split('T')[1] : '12:00:00.000';
  const newNextDate    = `${nextOccurrence}T${timePart}`;

  // Advance next_date FIRST with a conditional update — prevents duplicate recording
  // if two calls race on the same due item
  const result = await db.runAsync(
    'UPDATE planned_payments SET next_date = ? WHERE id = ? AND next_date = ?',
    [newNextDate, item.id, item.next_date]
  );
  if ((result?.changes ?? 0) === 0) return false; // another call won the race

  const txId = generateId();
  const accountId = item.account_id ?? null;
  await db.runAsync(
    `INSERT INTO transactions (id, user_id, category_id, amount, type, title, description, date, created_at, account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      txId, item.user_id, item.category_id ?? null, Number(item.amount),
      item.type || 'expense', item.title,
      item.description || `Auto-recorded from planned payment (${getFrequencyLabel(item.frequency)})`,
      item.next_date, new Date().toISOString(), accountId,
    ]
  );
  if (accountId) {
    const delta = (item.type || 'expense') === 'expense' ? -Number(item.amount) : Number(item.amount);
    await accountService.adjustBalance(accountId, delta).catch(() => {});
  }
  return true;
}

let dueSyncPromise = null;
async function processDuePlannedPayments(userId) {
  if (dueSyncPromise) return await dueSyncPromise;
  dueSyncPromise = (async () => {
    const db   = getDb();
    const rows = await db.getAllAsync(
      'SELECT * FROM planned_payments WHERE user_id = ? AND is_active = 1',
      [userId]
    );
    let changed = false;
    for (const item of rows) {
      const processed = await processSinglePlannedPayment(db, item).catch(() => false);
      if (processed) changed = true;
    }

    // Deactivate payments past their end_date
    const today = formatLocalDate(new Date());
    await db.runAsync(
      'UPDATE planned_payments SET is_active = 0 WHERE user_id = ? AND is_active = 1 AND end_date IS NOT NULL AND end_date < ?',
      [userId, today]
    );

    return changed;
  })();
  try { return await dueSyncPromise; } finally { dueSyncPromise = null; }
}

export const paymentService = {
  parseLocalDate,
  formatLocalDate,
  getFrequencyLabel,
  normalizeFrequency,
  syncDuePlannedPayments: processDuePlannedPayments,

  async getPlannedPayments(userId) {
    await processDuePlannedPayments(userId).catch(() => {});
    const db = getDb();
    return db.getAllAsync('SELECT * FROM planned_payments WHERE user_id = ? AND (is_active IS NULL OR is_active = 1) ORDER BY next_date ASC', [userId]);
  },

  async getArchivedPlannedPayments(userId) {
    const db = getDb();
    return db.getAllAsync('SELECT * FROM planned_payments WHERE user_id = ? AND is_active = 0 ORDER BY end_date DESC', [userId]);
  },

  async addPlannedPayment(paymentData) {
    const db = getDb();
    const { custom_days, ...rest } = paymentData;
    const id        = rest.id || generateId();
    const frequency = normalizeFrequency(paymentData.frequency, paymentData.custom_days);

    await db.runAsync(
      `INSERT INTO planned_payments
         (id, user_id, title, amount, type, frequency, next_date,
          category_id, description, is_active, start_date, end_date, created_at, account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        id, rest.user_id, rest.title, Number(rest.amount), rest.type || 'expense',
        frequency, rest.next_date, rest.category_id ?? null,
        rest.description ?? null, rest.start_date ?? null, rest.end_date ?? null,
        new Date().toISOString(), rest.account_id ?? null,
      ]
    );
    return true;
  },

  async updatePlannedPayment(id, fields) {
    const db     = getDb();
    const cols   = [];
    const vals   = [];
    const add    = (c, v) => { cols.push(`${c} = ?`); vals.push(v); };

    if (fields.title       !== undefined) add('title',       fields.title);
    if (fields.amount      !== undefined) add('amount',      Number(fields.amount));
    if (fields.type        !== undefined) add('type',        fields.type);
    if (fields.frequency   !== undefined) add('frequency',   fields.frequency);
    if (fields.next_date   !== undefined) add('next_date',   fields.next_date);
    if (fields.start_date  !== undefined) add('start_date',  fields.start_date ?? null);
    if (fields.end_date    !== undefined) add('end_date',    fields.end_date ?? null);
    if (fields.category_id !== undefined) add('category_id', fields.category_id ?? null);
    if (fields.description !== undefined) add('description', fields.description ?? null);
    if (fields.is_active   !== undefined) add('is_active',   fields.is_active ? 1 : 0);
    if (fields.account_id  !== undefined) add('account_id',  fields.account_id ?? null);

    if (cols.length === 0) return true;
    await db.runAsync(`UPDATE planned_payments SET ${cols.join(', ')} WHERE id = ?`, [...vals, id]);
    return true;
  },

  async recordPlannedPaymentNow(item) {
    const db        = getDb();
    const dueDate   = item.next_date || formatLocalDate(new Date());
    const accountId = item.account_id ?? null;

    await db.runAsync(
      `INSERT INTO transactions (id, user_id, category_id, amount, type, title, description, date, created_at, account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(), item.user_id, item.category_id ?? null, Number(item.amount),
        item.type || 'expense', item.title,
        item.description || `Recorded from planned payment (${getFrequencyLabel(item.frequency)})`,
        toTransactionTimestamp(dueDate), new Date().toISOString(), accountId,
      ]
    );
    if (accountId) {
      const delta = (item.type || 'expense') === 'expense' ? -Number(item.amount) : Number(item.amount);
      await accountService.adjustBalance(accountId, delta).catch(() => {});
    }

    const datePart       = dueDate.split('T')[0];
    const nextOccurrence = getNextOccurrence(datePart, item.frequency);
    const timePart       = dueDate.includes('T') ? dueDate.split('T')[1] : '12:00:00.000';
    const newNextDate    = `${nextOccurrence}T${timePart}`;

    await db.runAsync('UPDATE planned_payments SET next_date = ? WHERE id = ?', [newNextDate, item.id]);
    return true;
  },

  async deletePlannedPayment(id) {
    const db = getDb();
    await db.runAsync('DELETE FROM planned_payments WHERE id = ?', [id]);
    return true;
  },
};

export default paymentService;
