import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const KEYS = {
  TRANSACTIONS: 'oc_transactions',
  CATEGORIES: 'oc_categories',
  BUDGETS: 'oc_budgets',
  GOALS: 'oc_goals',
  PROFILE: 'oc_profile',
  QUEUE: 'oc_sync_queue',
  LAST_SYNC: 'oc_last_sync',
};

const TTL = 30 * 24 * 60 * 60 * 1000;

const createLocalId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === 'x' ? rand : ((rand & 0x3) | 0x8);
    return value.toString(16);
  });

const isNetworkError = (error) => {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('fetch failed')
  );
};

async function saveCache(key, data) {
  await AsyncStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
}

async function readCache(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > TTL) return null;
    return data;
  } catch {
    return null;
  }
}

async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue) {
  await AsyncStorage.setItem(KEYS.QUEUE, JSON.stringify(queue));
}

async function getQueuedOperationsForTable(table) {
  const queue = await getQueue();
  return queue.filter((item) => item.table === table);
}

function applyQueuedOperations(items, queuedOperations) {
  let next = [...items];

  for (const op of queuedOperations) {
    if (op.type === 'insert') {
      next = [op.data, ...next.filter((item) => item.id !== op.data?.id)];
    } else if (op.type === 'update') {
      next = next.map((item) => (item.id === op.id ? { ...item, ...op.data } : item));
    } else if (op.type === 'delete') {
      next = next.filter((item) => item.id !== op.id);
    }
  }

  return next;
}

function applyTransactionFilters(transactions, options = {}) {
  const { period = 'ALL', customStartDate, customEndDate } = options;
  if (period === 'ALL') return transactions;

  const now = new Date();
  let startDate = null;

  if (period === 'TODAY') {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (period === '1W') {
    startDate = new Date();
    startDate.setDate(now.getDate() - 7);
  } else if (period === '1M') {
    startDate = new Date();
    startDate.setMonth(now.getMonth() - 1);
  } else if (period === '6M') {
    startDate = new Date();
    startDate.setMonth(now.getMonth() - 6);
  } else if (period === '1Y') {
    startDate = new Date();
    startDate.setFullYear(now.getFullYear() - 1);
  } else if (period === 'CUSTOM' && customStartDate) {
    startDate = new Date(customStartDate);
  }

  let endDate = null;
  if (period === 'CUSTOM' && customEndDate) {
    endDate = new Date(customEndDate);
    endDate.setHours(23, 59, 59, 999);
  }

  return transactions.filter((transaction) => {
    const txDate = new Date(transaction.date);
    if (startDate && txDate < startDate) return false;
    if (endDate && txDate > endDate) return false;
    return true;
  });
}

async function mutateCachedCollection(cacheKey, updater) {
  const cached = (await readCache(cacheKey)) || [];
  const next = updater(cached);
  await saveCache(cacheKey, next);
  return next;
}

async function queueOperation(operation) {
  const queue = await getQueue();
  queue.push({
    ...operation,
    queuedAt: new Date().toISOString(),
    queueId: createLocalId(),
  });
  await saveQueue(queue);
}

export const offlineSync = {
  isNetworkError,

  async syncIfPossible() {
    try {
      return await this.syncPendingOperations();
    } catch {
      return { synced: 0, failed: await this.getPendingCount() };
    }
  },

  async getUserProfile(userId) {
    const cacheKey = `${KEYS.PROFILE}_${userId}`;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, currency')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (data) {
        await saveCache(cacheKey, data);
        return { data, fromCache: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }

    const cached = await readCache(cacheKey);
    return { data: cached || null, fromCache: true };
  },

  async saveUserProfile(userId, profile) {
    const cacheKey = `${KEYS.PROFILE}_${userId}`;
    const current = (await readCache(cacheKey)) || {};
    const next = { ...current, ...profile };
    await saveCache(cacheKey, next);
    return next;
  },

  async getTransactions(userId, options = {}) {
    const cacheKey = `${KEYS.TRANSACTIONS}_${userId}`;
    await this.syncIfPossible();
    const queuedOps = await getQueuedOperationsForTable('transactions');
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, categories(name, color, icon)')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;

      const rows = applyQueuedOperations(data || [], queuedOps)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      await saveCache(cacheKey, rows);
      return { data: applyTransactionFilters(rows, options), fromCache: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }

    const cached = applyQueuedOperations((await readCache(cacheKey)) || [], queuedOps)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    await saveCache(cacheKey, cached);
    return { data: applyTransactionFilters(cached, options), fromCache: true };
  },

  async getCategories(userId) {
    const cacheKey = `${KEYS.CATEGORIES}_${userId}`;
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order('name', { ascending: true });

      if (error) throw error;

      const rows = data || [];
      await saveCache(cacheKey, rows);
      return { data: rows, fromCache: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }

    const cached = await readCache(cacheKey);
    return { data: cached || [], fromCache: true };
  },

  async getBudgets(userId) {
    const cacheKey = `${KEYS.BUDGETS}_${userId}`;
    await this.syncIfPossible();
    const queuedOps = await getQueuedOperationsForTable('budgets');
    try {
      const { data, error } = await supabase
        .from('budgets')
        .select('*, categories(*)')
        .eq('user_id', userId);

      if (error) throw error;

      const rows = applyQueuedOperations(data || [], queuedOps);
      await saveCache(cacheKey, rows);
      return { data: rows, fromCache: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }

    const cached = applyQueuedOperations((await readCache(cacheKey)) || [], queuedOps);
    await saveCache(cacheKey, cached);
    return { data: cached || [], fromCache: true };
  },

  async getSavingsGoals(userId) {
    const cacheKey = `${KEYS.GOALS}_${userId}`;
    await this.syncIfPossible();
    const queuedOps = await getQueuedOperationsForTable('savings_goals');
    try {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = applyQueuedOperations(data || [], queuedOps)
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      await saveCache(cacheKey, rows);
      return { data: rows, fromCache: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }

    const cached = applyQueuedOperations((await readCache(cacheKey)) || [], queuedOps)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    await saveCache(cacheKey, cached);
    return { data: cached || [], fromCache: true };
  },

  async addTransaction(transactionData) {
    const payload = {
      ...transactionData,
      id: transactionData.id || createLocalId(),
    };
    const cacheKey = `${KEYS.TRANSACTIONS}_${transactionData.user_id}`;
    let queued = false;

    try {
      const { error } = await supabase.from('transactions').insert(payload);
      if (error) throw error;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await queueOperation({ type: 'insert', table: 'transactions', data: payload });
      queued = true;
    }

    await mutateCachedCollection(cacheKey, (items) =>
      [payload, ...items.filter((item) => item.id !== payload.id)]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
    );

    return { queued, id: payload.id };
  },

  async updateTransaction(id, transactionData) {
    const cacheKey = `${KEYS.TRANSACTIONS}_${transactionData.user_id}`;
    let queued = false;

    try {
      const { error } = await supabase
        .from('transactions')
        .update(transactionData)
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await queueOperation({ type: 'update', table: 'transactions', id, data: transactionData });
      queued = true;
    }

    await mutateCachedCollection(cacheKey, (items) =>
      items
        .map((item) => (item.id === id ? { ...item, ...transactionData } : item))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
    );

    return { queued, id };
  },

  async deleteTransaction(userId, id) {
    const cacheKey = `${KEYS.TRANSACTIONS}_${userId}`;
    let queued = false;

    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await queueOperation({ type: 'delete', table: 'transactions', id });
      queued = true;
    }

    await mutateCachedCollection(cacheKey, (items) => items.filter((item) => item.id !== id));
    return { queued, id };
  },

  async saveBudget(userId, budgetData, existingId = null) {
    const cacheKey = `${KEYS.BUDGETS}_${userId}`;
    const payload = {
      ...budgetData,
      id: existingId || budgetData.id || createLocalId(),
    };
    let queued = false;

    try {
      if (existingId) {
        const { error } = await supabase.from('budgets').update(budgetData).eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('budgets').insert(payload);
        if (error) throw error;
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await queueOperation({
        type: existingId ? 'update' : 'insert',
        table: 'budgets',
        id: existingId || payload.id,
        data: existingId ? budgetData : payload,
      });
      queued = true;
    }

    await mutateCachedCollection(cacheKey, (items) => {
      const withoutCurrent = items.filter((item) => item.id !== payload.id);
      return [{ ...items.find((item) => item.id === payload.id), ...payload }, ...withoutCurrent];
    });

    return { queued, id: payload.id };
  },

  async deleteBudget(userId, id) {
    const cacheKey = `${KEYS.BUDGETS}_${userId}`;
    let queued = false;

    try {
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await queueOperation({ type: 'delete', table: 'budgets', id });
      queued = true;
    }

    await mutateCachedCollection(cacheKey, (items) => items.filter((item) => item.id !== id));
    return { queued, id };
  },

  async saveSavingsGoal(userId, goalData, existingId = null) {
    const cacheKey = `${KEYS.GOALS}_${userId}`;
    const payload = {
      saved_amount: 0,
      ...goalData,
      id: existingId || goalData.id || createLocalId(),
    };
    let queued = false;

    try {
      if (existingId) {
        const { error } = await supabase.from('savings_goals').update(goalData).eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('savings_goals').insert(payload);
        if (error) throw error;
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await queueOperation({
        type: existingId ? 'update' : 'insert',
        table: 'savings_goals',
        id: existingId || payload.id,
        data: existingId ? goalData : payload,
      });
      queued = true;
    }

    await mutateCachedCollection(cacheKey, (items) => {
      const existing = items.find((item) => item.id === payload.id);
      const next = [{ ...existing, ...payload }, ...items.filter((item) => item.id !== payload.id)];
      return next.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    });

    return { queued, id: payload.id };
  },

  async updateSavingsGoal(userId, id, updates) {
    const cacheKey = `${KEYS.GOALS}_${userId}`;
    let queued = false;

    try {
      const { error } = await supabase.from('savings_goals').update(updates).eq('id', id);
      if (error) throw error;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await queueOperation({ type: 'update', table: 'savings_goals', id, data: updates });
      queued = true;
    }

    await mutateCachedCollection(cacheKey, (items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );

    return { queued, id };
  },

  async deleteSavingsGoal(userId, id) {
    const cacheKey = `${KEYS.GOALS}_${userId}`;
    let queued = false;

    try {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await queueOperation({ type: 'delete', table: 'savings_goals', id });
      queued = true;
    }

    await mutateCachedCollection(cacheKey, (items) => items.filter((item) => item.id !== id));
    return { queued, id };
  },

  async queueOperation(operation) {
    await queueOperation(operation);
  },

  async syncPendingOperations() {
    const queue = await getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    const failed = [];
    let synced = 0;

    for (const op of queue) {
      try {
        if (op.type === 'insert') {
          const { error } = await supabase.from(op.table).insert(op.data);
          if (error) throw error;
        } else if (op.type === 'update') {
          const { error } = await supabase.from(op.table).update(op.data).eq('id', op.id);
          if (error) throw error;
        } else if (op.type === 'delete') {
          const { error } = await supabase.from(op.table).delete().eq('id', op.id);
          if (error) throw error;
        }
        synced++;
      } catch (error) {
        failed.push(op);
        if (!isNetworkError(error)) {
          continue;
        }
      }
    }

    await saveQueue(failed);
    await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());

    return { synced, failed: failed.length };
  },

  async getPendingCount() {
    const queue = await getQueue();
    return queue.length;
  },

  async getLastSyncTime() {
    return await AsyncStorage.getItem(KEYS.LAST_SYNC);
  },

  async clearCache(userId) {
    await Promise.all([
      AsyncStorage.removeItem(`${KEYS.TRANSACTIONS}_${userId}`),
      AsyncStorage.removeItem(`${KEYS.CATEGORIES}_${userId}`),
      AsyncStorage.removeItem(`${KEYS.BUDGETS}_${userId}`),
      AsyncStorage.removeItem(`${KEYS.GOALS}_${userId}`),
      AsyncStorage.removeItem(`${KEYS.PROFILE}_${userId}`),
    ]);
  },

  KEYS,
};

export default offlineSync;
