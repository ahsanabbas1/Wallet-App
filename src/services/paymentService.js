import { supabase } from '../lib/supabase';

function parseLocalDate(dateString) {
  if (!dateString) return null;
  // If it contains a time or T, parse as full ISO
  if (dateString.includes('T') || dateString.includes(':')) return new Date(dateString);
  
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date); next.setDate(next.getDate() + days); return next;
}
function addMonths(date, months) {
  const next = new Date(date); next.setMonth(next.getMonth() + months); return next;
}
function addYears(date, years) {
  const next = new Date(date); next.setFullYear(next.getFullYear() + years); return next;
}

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
  const baseDate = parseLocalDate(dateString);
  if (!baseDate) return dateString;
  if (frequency === 'daily') return formatLocalDate(addDays(baseDate, 1));
  if (frequency === 'weekly') return formatLocalDate(addDays(baseDate, 7));
  if (frequency === 'monthly') return formatLocalDate(addMonths(baseDate, 1));
  if (frequency === 'yearly') return formatLocalDate(addYears(baseDate, 1));
  if (frequency?.startsWith('custom:')) {
    const days = Math.max(1, Number(frequency.split(':')[1] || 1));
    return formatLocalDate(addDays(baseDate, days));
  }
  return formatLocalDate(addMonths(baseDate, 1));
}

function getDueDates(nextDateString, frequency, untilDate = new Date()) {
  const dueDates = [];
  let cursor = nextDateString;
  for (let i = 0; i < 120; i++) {
    const dueDate = parseLocalDate(cursor);
    if (!dueDate || dueDate > untilDate) break;
    dueDates.push(cursor);
    cursor = getNextOccurrence(cursor, frequency);
  }
  return { dueDates, nextDate: cursor };
}

function toTransactionTimestamp(dateString) {
  // If it's already an ISO string with time, return it. Otherwise add default time.
  if (dateString.includes('T')) return dateString;
  return `${dateString}T12:00:00.000`;
}

function createId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => ((Math.random() * 16) | 0).toString(16));
}

async function processSinglePlannedPayment(item) {
  const now = new Date();

  if (!item.next_date || !item.is_active) return false;

  // Check start/end bounds
  if (item.end_date) {
    const endDate = parseLocalDate(item.end_date);
    if (endDate && now > endDate) return false;
  }
  if (item.start_date) {
    const startDate = parseLocalDate(item.start_date);
    if (startDate && now < startDate) return false;
  }

  // Compare full timestamp: next_date vs now
  const nextDue = new Date(item.next_date);
  if (isNaN(nextDue.getTime()) || nextDue > now) return false;

  // Compute the new next_date before touching the DB
  const nextOccurrence = getNextOccurrence(item.next_date.split('T')[0], item.frequency);
  const timePart = item.next_date.includes('T') ? item.next_date.split('T')[1] : '12:00:00.000';
  const newNextDate = `${nextOccurrence}T${timePart}`;

  // Advance next_date FIRST with a conditional update (WHERE next_date = current value).
  // If another concurrent call already advanced it, this update matches 0 rows and we
  // skip the insert — preventing duplicate transactions.
  const { data: updated, error: updateError } = await supabase
    .from('planned_payments')
    .update({ next_date: newNextDate })
    .eq('id', item.id)
    .eq('next_date', item.next_date)
    .select('id');
  if (updateError) throw updateError;
  if (!updated || updated.length === 0) return false; // another call already processed this

  // Now safely record the transaction
  const tx = {
    id: createId(),
    user_id: item.user_id,
    category_id: item.category_id ?? null,
    amount: Number(item.amount),
    type: item.type || 'expense',
    title: item.title,
    description: item.description || `Auto-recorded from planned payment (${getFrequencyLabel(item.frequency)})`,
    date: item.next_date,
  };

  const { error: insertError } = await supabase.from('transactions').insert(tx);
  if (insertError) throw insertError;

  return true;
}

let dueSyncPromise = null;
async function processDuePlannedPayments(userId) {
  if (dueSyncPromise) return await dueSyncPromise;
  dueSyncPromise = (async () => {
    const { data } = await supabase.from('planned_payments').select('*').eq('user_id', userId);
    let changed = false;
    for (const item of data || []) {
      if (item.is_active) {
        const processed = await processSinglePlannedPayment(item).catch(() => false);
        if (processed) changed = true;
      }
    }
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
    const { data, error } = await supabase.from('planned_payments').select('*').eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },

  async addPlannedPayment(paymentData) {
    // custom_days is a UI helper and shouldn't be sent to Supabase
    const { custom_days, ...rest } = paymentData;

    const payload = {
      ...rest,
      id: paymentData.id || createId(),
      frequency: normalizeFrequency(paymentData.frequency, paymentData.custom_days),
      is_active: true,
      created_at: new Date().toISOString(),
      amount: Number(paymentData.amount),
    };
    const { error } = await supabase.from('planned_payments').insert(payload);
    if (error) throw error;
    return true;
  },

  async updatePlannedPayment(id, fields) {
    const { error } = await supabase.from('planned_payments').update(fields).eq('id', id);
    if (error) throw error;
    return true;
  },

  async recordPlannedPaymentNow(item) {
    const dueDate = item.next_date || formatLocalDate(new Date());
    const tx = {
      id: createId(),
      user_id: item.user_id,
      category_id: item.category_id ?? null,
      amount: Number(item.amount),
      type: item.type || 'expense',
      title: item.title,
      description: item.description || `Recorded from planned payment (${getFrequencyLabel(item.frequency)})`,
      date: toTransactionTimestamp(dueDate),
    };

    const { error: insertError } = await supabase.from('transactions').insert(tx);
    if (insertError) throw insertError;

    // Advance next_date to exactly one period later
    const datePart = dueDate.split('T')[0];
    const nextOccurrence = getNextOccurrence(datePart, item.frequency);
    const timePart = dueDate.includes('T') ? dueDate.split('T')[1] : '12:00:00.000';
    const newNextDate = `${nextOccurrence}T${timePart}`;

    await supabase.from('planned_payments').update({ next_date: newNextDate }).eq('id', item.id);
    return true;
  },

  async deletePlannedPayment(id) {
    const { error } = await supabase.from('planned_payments').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};

export default paymentService;
