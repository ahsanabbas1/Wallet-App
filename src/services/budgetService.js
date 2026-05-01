import { supabase } from '../lib/supabase';
import localDatabase from './localDatabase';
import financeSyncService from './financeSyncService';

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

export const budgetService = {
  async getBudgets(userId) {
    await localDatabase.initialize();
    const rows = await localDatabase.getBudgets(userId);
    // Background sync — does not block the response
    financeSyncService.refreshBudgets(userId).catch(() => {});
    return { data: rows.map((row) => localDatabase.mapBudgetRow(row)), fromLocal: true };
  },

  async saveBudget(userId, budgetData, existingId = null) {
    await localDatabase.initialize();
    const payload = {
      ...budgetData,
      id: existingId || budgetData.id || createLocalId(),
      user_id: userId,
      total_amount: Number(budgetData.total_amount),
      created_at: budgetData.created_at || new Date().toISOString(),
    };

    try {
      if (existingId) {
        const { error } = await supabase
          .from('budgets')
          .update({
            category_id: payload.category_id,
            total_amount: payload.total_amount,
            period: payload.period,
          })
          .eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('budgets').insert(payload);
        if (error) throw error;
      }
      await localDatabase.saveBudget(payload, 'synced');
      return { queued: false, id: payload.id };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.saveBudget(payload, existingId ? 'pending_update' : 'pending_create');
      return { queued: true, id: payload.id };
    }
  },

  async deleteBudget(userId, id) {
    await localDatabase.initialize();
    try {
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) throw error;
      await localDatabase.removeBudget(id);
      return { queued: false, id };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.markBudgetDeleted(id, userId, 'pending_delete');
      return { queued: true, id };
    }
  },
};

export default budgetService;
