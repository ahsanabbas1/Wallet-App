import { supabase } from '../lib/supabase';
import localDatabase from './localDatabase';
import financeSyncService from './financeSyncService';

function isNetworkError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('fetch failed')
  );
}

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

async function processSinglePlannedPayment(item) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (!item.next_date || !item.is_active) return false;

  if (item.end_date) {
    const endDate = parseLocalDate(item.end_date);
    if (endDate && today > endDate) return false;
  }

  if (item.start_date) {
    const startDate = parseLocalDate(item.start_date);
    if (startDate && today < startDate) return false;
  }

  const dueDate = parseLocalDate(item.next_date);
  if (!dueDate || dueDate > today) return false;

  const { dueDates, nextDate } = getDueDates(item.next_date, item.frequency, today);
  if (!dueDates.length) return false;

  const transactions = dueDates.map((dateString) => ({
    id: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>((Math.random()*16)|0).toString(16)),
    user_id: item.user_id,
    category_id: item.category_id ?? null,
    amount: Number(item.amount),
    type: item.type || 'expense',
    title: item.title,
    description: item.description || `Recorded from planned payment (${getFrequencyLabel(item.frequency)})`,
    date: toTransactionTimestamp(dateString),
  }));

  try {
    const { error: insertError } = await supabase.from('transactions').insert(transactions);
    if (insertError) throw insertError;

    // Local save as synced
    for (const tx of transactions) {
      await localDatabase.saveTransaction(tx, 'synced');
    }
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    // Queue transactions locally
    for (const tx of transactions) {
      await localDatabase.saveTransaction(tx, 'pending_create');
    }
  }

  const updatedItem = { ...item, next_date: nextDate };
  try {
    const { error } = await supabase.from('planned_payments').update({ next_date: nextDate }).eq('id', item.id);
    if (error) throw error;
    await localDatabase.savePlannedPayment(updatedItem, 'synced');
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await localDatabase.savePlannedPayment(updatedItem, 'pending_update');
  }
  
  return true;
}

let dueSyncPromise = null;
async function processDuePlannedPayments(userId) {
  if (dueSyncPromise) return await dueSyncPromise;
  dueSyncPromise = (async () => {
    const data = await localDatabase.getPlannedPayments(userId);
    let changed = false;
    for (const item of data || []) {
      if (item.is_active) {
        const processed = await processSinglePlannedPayment(item);
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
    await localDatabase.initialize();
    await processDuePlannedPayments(userId).catch(() => {});
    const data = await localDatabase.getPlannedPayments(userId);
    financeSyncService.refreshPlannedPayments(userId).catch(() => {});
    return data;
  },

  async addPlannedPayment(paymentData) {
    await localDatabase.initialize();
    const payload = {
      ...paymentData,
      id: paymentData.id || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>((Math.random()*16)|0).toString(16)),
      frequency: normalizeFrequency(paymentData.frequency, paymentData.custom_days),
      is_active: true,
      created_at: new Date().toISOString(),
      amount: Number(paymentData.amount),
    };

    try {
      const { error } = await supabase.from('planned_payments').insert(payload);
      if (error) throw error;
      await localDatabase.savePlannedPayment(payload, 'synced');
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.savePlannedPayment(payload, 'pending_create');
    }
    return true;
  },

  async updatePlannedPayment(id, fields) {
    await localDatabase.initialize();
    const current = await localDatabase.getPlannedPayments(fields.user_id);
    const existing = current.find(p => p.id === id);
    const payload = { ...existing, ...fields };

    try {
      const { error } = await supabase.from('planned_payments').update(fields).eq('id', id);
      if (error) throw error;
      await localDatabase.savePlannedPayment(payload, 'synced');
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.savePlannedPayment(payload, 'pending_update');
    }
    return true;
  },

  async recordPlannedPaymentNow(item) {
    const dueDate = item.next_date || formatLocalDate(new Date());
    const txId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>((Math.random()*16)|0).toString(16));
    
    const tx = {
      id: txId,
      user_id: item.user_id,
      category_id: item.category_id ?? null,
      amount: Number(item.amount),
      type: item.type || 'expense',
      title: item.title,
      description: item.description || `Recorded from planned payment (${getFrequencyLabel(item.frequency)})`,
      date: toTransactionTimestamp(dueDate),
    };

    try {
      const { error: insertError } = await supabase.from('transactions').insert(tx);
      if (insertError) throw insertError;
      await localDatabase.saveTransaction(tx, 'synced');
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.saveTransaction(tx, 'pending_create');
    }

    const nextDate = getNextOccurrence(dueDate, item.frequency);
    const updatedItem = { ...item, next_date: nextDate };
    
    try {
      const { error } = await supabase.from('planned_payments').update({ next_date: nextDate }).eq('id', item.id);
      if (error) throw error;
      await localDatabase.savePlannedPayment(updatedItem, 'synced');
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.savePlannedPayment(updatedItem, 'pending_update');
    }
    return true;
  },

  async deletePlannedPayment(userId, id) {
    await localDatabase.initialize();
    try {
      const { error } = await supabase.from('planned_payments').delete().eq('id', id);
      if (error) throw error;
      await localDatabase.removePlannedPayment(id);
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.deletePlannedPayment(id, userId);
    }
    return true;
  }
};

export default paymentService;
