import localDatabase from './localDatabase';
import transactionSyncService from './transactionSyncService';
import { supabase } from '../lib/supabase';

function createLocalId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === 'x' ? rand : ((rand & 0x3) | 0x8);
    return value.toString(16);
  });
}

function isNetworkError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('fetch failed')
  );
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

async function readLocalTransactions(userId, options = {}) {
  const rows = await localDatabase.getTransactions(userId);
  const mapped = rows.map((row) => localDatabase.mapTransactionRow(row));
  return applyTransactionFilters(mapped, options);
}

export const transactionService = {
  async initialize(userId = null) {
    await transactionSyncService.initialize();
    if (userId) {
      await transactionSyncService.refreshCategories(userId);
    }
  },

  async getCategories(userId) {
    await this.initialize(userId);
    const local = await localDatabase.getCategories(userId);
    if (local.length > 0) {
      // Return local immediately — refresh categories in background
      transactionSyncService.refreshCategories(userId).catch(() => {});
      return local;
    }
    // First-ever launch: must wait for network to populate local cache
    await transactionSyncService.refreshCategories(userId);
    return await localDatabase.getCategories(userId);
  },

  async getTransactions(userId, options = {}) {
    await this.initialize(userId);
    // ── INSTANT: return local data without waiting for network ──
    const data = await readLocalTransactions(userId, options);
    // Background sync — does not block the response
    transactionSyncService.refreshTransactions(userId).catch(() => {});
    return { data, fromLocal: true };
  },

  async addTransaction(transactionData) {
    await this.initialize(transactionData.user_id);

    const payload = {
      ...transactionData,
      id: transactionData.id || createLocalId(),
      amount: Number(transactionData.amount),
      created_at: transactionData.created_at || transactionData.date || new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('transactions').insert(payload);
      if (error) throw error;

      await localDatabase.saveTransaction(payload, 'synced');
      return { queued: false, id: payload.id };
    } catch (error) {
      if (!isNetworkError(error)) throw error;

      await localDatabase.saveTransaction(payload, 'pending_create');
      return { queued: true, id: payload.id };
    }
  },

  async updateTransaction(id, transactionData) {
    await this.initialize(transactionData.user_id);

    const payload = {
      ...transactionData,
      id,
      amount: Number(transactionData.amount),
      created_at: transactionData.created_at || transactionData.date || new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          category_id: payload.category_id,
          amount: payload.amount,
          type: payload.type,
          title: payload.title,
          description: payload.description,
          date: payload.date,
        })
        .eq('id', id);

      if (error) throw error;

      await localDatabase.saveTransaction(payload, 'synced');
      return { queued: false, id };
    } catch (error) {
      if (!isNetworkError(error)) throw error;

      await localDatabase.saveTransaction(payload, 'pending_update');
      return { queued: true, id };
    }
  },

  async deleteTransaction(userId, id) {
    await this.initialize(userId);

    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;

      await localDatabase.removeTransaction(id);
      return { queued: false, id };
    } catch (error) {
      if (!isNetworkError(error)) throw error;

      await localDatabase.markTransactionDeleted(id, userId, 'pending_delete');
      return { queued: true, id };
    }
  },
};

export default transactionService;
