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

function isMissingColumn(error, columnName) {
  const message = String(error?.message || error || '').toLowerCase();
  const col = columnName.toLowerCase();
  return (
    message.includes(col) &&
    (message.includes('does not exist') ||
      message.includes('column') ||
      message.includes('could not find') ||
      message.includes('schema cache'))
  );
}

function isMissingIsActiveColumn(error) {
  const message = String(error?.message || error || '').toLowerCase();
  const isActiveMissing = message.includes('is_active') &&
    (message.includes('does not exist') ||
      message.includes('column') ||
      message.includes('could not find') ||
      message.includes('schema cache'));
  return message.includes('planned_payments') && isActiveMissing;
}

let plannedPaymentsSupportsCategoryId = true;
let plannedPaymentsSupportsStartEndDate = true;

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

async function updatePlannedPayment(id, fields) {
  const payload = { ...fields };

  // Strip columns that may not exist in older schemas
  if (!plannedPaymentsSupportsCategoryId) delete payload.category_id;
  if (!plannedPaymentsSupportsStartEndDate) {
    delete payload.start_date;
    delete payload.end_date;
  }

  let { error } = await supabase.from('planned_payments').update(payload).eq('id', id);

  if (error && isMissingColumn(error, 'category_id')) {
    plannedPaymentsSupportsCategoryId = false;
    const retry = { ...payload };
    delete retry.category_id;
    ({ error } = await supabase.from('planned_payments').update(retry).eq('id', id));
  }

  if (error && (isMissingColumn(error, 'start_date') || isMissingColumn(error, 'end_date'))) {
    plannedPaymentsSupportsStartEndDate = false;
    const retry = { ...payload };
    delete retry.start_date;
    delete retry.end_date;
    delete retry.category_id;
    ({ error } = await supabase.from('planned_payments').update(retry).eq('id', id));
  }

  if (error) throw error;
}

async function processSinglePlannedPayment(item) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (!item.next_date) return false;

  // Don't process if end_date has passed
  if (item.end_date) {
    const endDate = parseLocalDate(item.end_date);
    if (endDate && today > endDate) return false;
  }

  // Don't process if start_date hasn't arrived yet
  if (item.start_date) {
    const startDate = parseLocalDate(item.start_date);
    if (startDate && today < startDate) return false;
  }

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
  updatePlannedPayment,

  async getPlannedPayments(userId) {
    await processDuePlannedPayments(userId);
    return await listPlannedPayments(userId);
  },

  async addPlannedPayment(paymentData) {
    const payload = {
      user_id:    paymentData.user_id,
      title:      paymentData.title,
      amount:     paymentData.amount,
      type:       paymentData.type,
      frequency:  normalizeFrequency(paymentData.frequency, paymentData.custom_days),
      next_date:  paymentData.next_date || paymentData.start_date,
      start_date: paymentData.start_date || null,
      end_date:   paymentData.end_date   || null,
      is_active:  true,
    };

    if (plannedPaymentsSupportsCategoryId && paymentData.category_id) {
      payload.category_id = paymentData.category_id;
    }
    if (!plannedPaymentsSupportsStartEndDate) {
      delete payload.start_date;
      delete payload.end_date;
    }

    let { error } = await supabase.from('planned_payments').insert(payload);

    // Fallback: strip category_id if column doesn't exist yet
    if (error && isMissingColumn(error, 'category_id')) {
      plannedPaymentsSupportsCategoryId = false;
      const retry = { ...payload };
      delete retry.category_id;
      ({ error } = await supabase.from('planned_payments').insert(retry));
    }

    // Fallback: strip start_date / end_date if columns don't exist yet
    if (error && (isMissingColumn(error, 'start_date') || isMissingColumn(error, 'end_date'))) {
      plannedPaymentsSupportsStartEndDate = false;
      const retry = { ...payload };
      delete retry.start_date;
      delete retry.end_date;
      delete retry.category_id;
      ({ error } = await supabase.from('planned_payments').insert(retry));
    }

    // Fallback: strip is_active if column doesn't exist yet
    if (error && isMissingIsActiveColumn(error)) {
      plannedPaymentsSupportsIsActive = false;
      const retry = { ...payload };
      delete retry.is_active;
      delete retry.category_id;
      ({ error } = await supabase.from('planned_payments').insert(retry));
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
