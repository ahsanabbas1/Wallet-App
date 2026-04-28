import { supabase } from '../lib/supabase';

function parseLocalDate(dateString) {
  if (!dateString) return null;
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
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addYears(date, years) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function normalizeFrequency(frequency, customDays) {
  if (frequency === 'custom') {
    return `custom:${Math.max(1, Number(customDays) || 1)}`;
  }
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
  const limit = 120;

  for (let i = 0; i < limit; i += 1) {
    const dueDate = parseLocalDate(cursor);
    if (!dueDate || dueDate > untilDate) break;
    dueDates.push(cursor);
    cursor = getNextOccurrence(cursor, frequency);
  }

  return {
    dueDates,
    nextDate: cursor,
  };
}

function toTransactionTimestamp(dateString) {
  return `${dateString}T12:00:00.000`;
}

let dueSyncPromise = null;
let plannedPaymentsSupportsIsActive = true;

function isMissingIsActiveColumn(error) {
  const message = String(error?.message || error || '').toLowerCase();
  // Check for various error message formats
  const isActiveMissing = message.includes('is_active') &&
    (message.includes('does not exist') ||
      message.includes('column') ||
      message.includes('could not find') ||
      message.includes('schema cache'));
  const plannedPaymentsMissing = message.includes('planned_payments');

  return plannedPaymentsMissing && isActiveMissing;
}

async function listPlannedPayments(userId) {
  let query = supabase
    .from('planned_payments')
    .select('*')
    .eq('user_id', userId)
    .order('next_date', { ascending: true });

  if (plannedPaymentsSupportsIsActive) {
    const { data, error } = await query.eq('is_active', true);
    if (!error) return data || [];
    if (!isMissingIsActiveColumn(error)) throw error;
    plannedPaymentsSupportsIsActive = false;
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function updatePlannedPaymentRecord(id, updates) {
  const { error } = await supabase.from('planned_payments').update(updates).eq('id', id);
  if (error) throw error;
}

async function processSinglePlannedPayment(item) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (!item.next_date) return false;

  const dueDate = parseLocalDate(item.next_date);
  if (!dueDate || dueDate > today) return false;

  const { dueDates, nextDate } = getDueDates(item.next_date, item.frequency, today);
  if (!dueDates.length) return false;

  const transactions = dueDates.map((dateString) => ({
    user_id: item.user_id,
    category_id: item.category_id ?? null,
    amount: Number(item.amount),
    type: item.type || 'expense',
    title: item.title,
    description: item.description || `Recorded from planned payment (${getFrequencyLabel(item.frequency)})`,
    date: toTransactionTimestamp(dateString),
  }));

  const { error: insertError } = await supabase.from('transactions').insert(transactions);
  if (insertError) throw insertError;

  await updatePlannedPaymentRecord(item.id, { next_date: nextDate });
  return true;
}

async function processDuePlannedPayments(userId) {
  if (dueSyncPromise) {
    return await dueSyncPromise;
  }

  dueSyncPromise = (async () => {
    const data = await listPlannedPayments(userId);

    let changed = false;
    for (const item of data || []) {
      const processed = await processSinglePlannedPayment(item);
      if (processed) changed = true;
    }

    return changed;
  })();

  try {
    return await dueSyncPromise;
  } finally {
    dueSyncPromise = null;
  }
}

export const paymentService = {
  parseLocalDate,
  formatLocalDate,
  getFrequencyLabel,
  normalizeFrequency,
  syncDuePlannedPayments: processDuePlannedPayments,

  async getPlannedPayments(userId) {
    await processDuePlannedPayments(userId);
    return await listPlannedPayments(userId);
  },

  async addPlannedPayment(paymentData) {
    const payload = {
      ...paymentData,
      frequency: normalizeFrequency(paymentData.frequency, paymentData.custom_days),
      next_date: paymentData.next_date,
      is_active: true,
    };

    delete payload.custom_days;
    delete payload.status;

    let { error } = await supabase
      .from('planned_payments')
      .insert(payload);

    if (error && isMissingIsActiveColumn(error)) {
      plannedPaymentsSupportsIsActive = false;
      const fallbackPayload = { ...payload };
      delete fallbackPayload.is_active;
      ({ error } = await supabase.from('planned_payments').insert(fallbackPayload));
    }

    if (error) throw error;
    return true;
  },

  async recordPlannedPaymentNow(item) {
    const dueDate = item.next_date || formatLocalDate(new Date());

    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: item.user_id,
      category_id: item.category_id ?? null,
      amount: Number(item.amount),
      type: item.type || 'expense',
      title: item.title,
      description: item.description || `Recorded from planned payment (${getFrequencyLabel(item.frequency)})`,
      date: toTransactionTimestamp(dueDate),
    });

    if (insertError) throw insertError;

    const nextDate = getNextOccurrence(dueDate, item.frequency);
    await updatePlannedPaymentRecord(item.id, { next_date: nextDate });
    return true;
  },

  async deletePlannedPayment(id) {
    if (plannedPaymentsSupportsIsActive) {
      const { error } = await supabase
        .from('planned_payments')
        .update({ is_active: false })
        .eq('id', id);

      if (!error) return true;
      if (!isMissingIsActiveColumn(error)) throw error;
      plannedPaymentsSupportsIsActive = false;
    }

    const { error } = await supabase
      .from('planned_payments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};
