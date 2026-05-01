import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import localDatabase from './localDatabase';

function isNetworkError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('fetch failed')
  );
}

function normalizeRemoteTransaction(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    category_id: row.category_id ?? null,
    amount: Number(row.amount),
    type: row.type,
    title: row.title,
    description: row.description ?? null,
    date: row.date,
    created_at: row.created_at ?? row.date,
    updated_at: row.updated_at ?? row.created_at ?? row.date,
  };
}

async function pullCategories(userId) {
  try {
    let res = await supabase
      .from('categories')
      .select('id, user_id, parent_id, name, icon, color, type, created_at')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('name', { ascending: true });

    if (res.error) {
      // If parent_id doesn't exist in Supabase yet, retry without it
      if (res.error.code === 'PGRST204' || (res.error.message && res.error.message.includes('parent_id'))) {
        res = await supabase
          .from('categories')
          .select('id, user_id, name, icon, color, type, created_at')
          .or(`user_id.eq.${userId},user_id.is.null`)
          .order('name', { ascending: true });
      }
    }

    if (res.error) throw res.error;
    await localDatabase.replaceCategories(res.data || []);
    return res.data || [];
  } catch (err) {
    console.error('pullCategories fatal error:', err);
    throw err;
  }
}

async function pullTransactions(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, user_id, category_id, amount, type, title, description, date, created_at')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) throw error;
  const rows = (data || []).map(normalizeRemoteTransaction);
  await localDatabase.upsertRemoteTransactions(rows);
  return rows;
}

async function pushPendingTransaction(transaction) {
  const payload = {
    id: transaction.id,
    user_id: transaction.user_id,
    category_id: transaction.category_id ?? null,
    amount: Number(transaction.amount),
    type: transaction.type,
    title: transaction.title,
    description: transaction.description ?? null,
    date: transaction.date,
    created_at: transaction.created_at ?? transaction.date,
  };

  if (transaction.sync_status === 'pending_create') {
    const { error } = await supabase.from('transactions').insert(payload);
    if (error) throw error;
    await localDatabase.markTransactionSynced(transaction.id);
    return;
  }

  if (transaction.sync_status === 'pending_update') {
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
      .eq('id', transaction.id);
    if (error) throw error;
    await localDatabase.markTransactionSynced(transaction.id);
    return;
  }

  if (transaction.sync_status === 'pending_delete') {
    const { error } = await supabase.from('transactions').delete().eq('id', transaction.id);
    if (error) throw error;
    await localDatabase.removeTransaction(transaction.id);
  }
}

export const transactionSyncService = {
  async initialize() {
    await localDatabase.initialize();
  },

  async refreshCategories(userId) {
    await localDatabase.initialize();
    try {
      await pullCategories(userId);
      return { refreshed: true };
    } catch (error) {
      console.error('refreshCategories error:', error);
      // Temporary alert for debugging APK build
      // Alert.alert('Category Sync Error', error.message || String(error));
      return { refreshed: false, error };
    }
  },

  async refreshTransactions(userId) {
    await localDatabase.initialize();
    try {
      await this.syncPendingTransactions(userId);
      await pullCategories(userId);
      await pullTransactions(userId);
      return { refreshed: true };
    } catch (error) {
      console.error('refreshTransactions error:', error);
      // Alert.alert('Transaction Sync Error', error.message || String(error));
      return { refreshed: false, error };
    }
  },

  async syncPendingTransactions(userId) {
    await localDatabase.initialize();
    const pending = await localDatabase.getPendingTransactions(userId);
    if (!pending.length) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const transaction of pending) {
      try {
        await pushPendingTransaction(transaction);
        synced += 1;
      } catch (error) {
        failed += 1;
        await localDatabase.markTransactionSyncError(transaction.id, error?.message);
        if (isNetworkError(error)) {
          break;
        }
      }
    }

    return { synced, failed };
  },
};

export default transactionSyncService;
