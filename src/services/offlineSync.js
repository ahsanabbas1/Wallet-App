import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const KEYS = {
  TRANSACTIONS: 'oc_transactions',
  CATEGORIES: 'oc_categories',
  BUDGETS: 'oc_budgets',
  GOALS: 'oc_goals',
  QUEUE: 'oc_sync_queue',
  LAST_SYNC: 'oc_last_sync',
};

// 30-day TTL in ms
const TTL = 30 * 24 * 60 * 60 * 1000;

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Public API ──────────────────────────────────────────────────────────────

export const offlineSync = {
  /**
   * Fetch transactions for a user. Uses network first, falls back to cache.
   */
  async getTransactions(userId) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, categories(name, color, icon)')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (!error && data) {
        await saveCache(KEYS.TRANSACTIONS + '_' + userId, data);
        return { data, fromCache: false };
      }
    } catch {}

    const cached = await readCache(KEYS.TRANSACTIONS + '_' + userId);
    return { data: cached || [], fromCache: true };
  },

  /**
   * Fetch categories. Uses network first, falls back to cache.
   */
  async getCategories(userId) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${userId},user_id.is.null`);

      if (!error && data) {
        await saveCache(KEYS.CATEGORIES + '_' + userId, data);
        return { data, fromCache: false };
      }
    } catch {}

    const cached = await readCache(KEYS.CATEGORIES + '_' + userId);
    return { data: cached || [], fromCache: true };
  },

  /**
   * Fetch budgets for a user.
   */
  async getBudgets(userId) {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .select('*, categories(*)')
        .eq('user_id', userId);

      if (!error && data) {
        await saveCache(KEYS.BUDGETS + '_' + userId, data);
        return { data, fromCache: false };
      }
    } catch {}

    const cached = await readCache(KEYS.BUDGETS + '_' + userId);
    return { data: cached || [], fromCache: true };
  },

  /**
   * Fetch savings goals for a user.
   */
  async getSavingsGoals(userId) {
    try {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        await saveCache(KEYS.GOALS + '_' + userId, data);
        return { data, fromCache: false };
      }
    } catch {}

    const cached = await readCache(KEYS.GOALS + '_' + userId);
    return { data: cached || [], fromCache: true };
  },

  /**
   * Queue a write operation for later sync (when network is unavailable).
   * operation: { type: 'insert'|'update'|'delete', table: string, data?: object, id?: string }
   */
  async queueOperation(operation) {
    const queue = await getQueue();
    queue.push({ ...operation, queuedAt: new Date().toISOString(), queueId: Date.now().toString() });
    await saveQueue(queue);
  },

  /**
   * Attempt to sync all queued operations to Supabase.
   * Returns { synced, failed }.
   */
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
      } catch {
        failed.push(op);
      }
    }

    await saveQueue(failed);
    await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());

    return { synced, failed: failed.length };
  },

  /**
   * Returns the number of operations waiting to sync.
   */
  async getPendingCount() {
    const queue = await getQueue();
    return queue.length;
  },

  /**
   * Returns ISO timestamp of last successful sync, or null.
   */
  async getLastSyncTime() {
    return await AsyncStorage.getItem(KEYS.LAST_SYNC);
  },

  /**
   * Clear all offline cache (not the queue).
   */
  async clearCache(userId) {
    await Promise.all([
      AsyncStorage.removeItem(KEYS.TRANSACTIONS + '_' + userId),
      AsyncStorage.removeItem(KEYS.CATEGORIES + '_' + userId),
      AsyncStorage.removeItem(KEYS.BUDGETS + '_' + userId),
      AsyncStorage.removeItem(KEYS.GOALS + '_' + userId),
    ]);
  },

  KEYS,
};

export default offlineSync;
