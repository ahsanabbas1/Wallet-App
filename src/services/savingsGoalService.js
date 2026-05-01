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

export const savingsGoalService = {
  async getSavingsGoals(userId) {
    await localDatabase.initialize();
    const rows = await localDatabase.getSavingsGoals(userId);
    // Background sync — does not block the response
    financeSyncService.refreshSavingsGoals(userId).catch(() => {});
    return { data: rows.map((row) => localDatabase.mapSavingsGoalRow(row)), fromLocal: true };
  },

  async saveSavingsGoal(userId, goalData, existingId = null) {
    await localDatabase.initialize();
    const payload = {
      saved_amount: 0,
      ...goalData,
      id: existingId || goalData.id || createLocalId(),
      user_id: userId,
      target_amount: Number(goalData.target_amount),
      saved_amount: Number(goalData.saved_amount ?? 0),
      repeat_value: goalData.repeat_value == null ? null : Number(goalData.repeat_value),
      created_at: goalData.created_at || new Date().toISOString(),
    };

    try {
      if (existingId) {
        const { error } = await supabase
          .from('savings_goals')
          .update({
            title: payload.title,
            target_amount: payload.target_amount,
            saved_amount: payload.saved_amount,
            icon: payload.icon ?? null,
            color: payload.color ?? null,
            start_date: payload.start_date ?? null,
            target_date: payload.target_date ?? null,
            repeat_basis: payload.repeat_basis ?? null,
            repeat_value: payload.repeat_value ?? null,
          })
          .eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('savings_goals').insert(payload);
        if (error) throw error;
      }
      await localDatabase.saveSavingsGoal(payload, 'synced');
      return { queued: false, id: payload.id };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.saveSavingsGoal(payload, existingId ? 'pending_update' : 'pending_create');
      return { queued: true, id: payload.id };
    }
  },

  async updateSavingsGoal(userId, id, updates) {
    await localDatabase.initialize();
    const currentRows = await localDatabase.getSavingsGoals(userId);
    const existing = currentRows.find((row) => row.id === id);
    const payload = {
      ...existing,
      ...updates,
      id,
      user_id: userId,
      target_amount: Number((updates.target_amount ?? existing?.target_amount) ?? 0),
      saved_amount: Number((updates.saved_amount ?? existing?.saved_amount) ?? 0),
      repeat_value: updates.repeat_value == null
        ? existing?.repeat_value ?? null
        : Number(updates.repeat_value),
      created_at: existing?.created_at || new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('savings_goals')
        .update({
          title: payload.title,
          target_amount: payload.target_amount,
          saved_amount: payload.saved_amount,
          icon: payload.icon ?? null,
          color: payload.color ?? null,
          start_date: payload.start_date ?? null,
          target_date: payload.target_date ?? null,
          repeat_basis: payload.repeat_basis ?? null,
          repeat_value: payload.repeat_value ?? null,
        })
        .eq('id', id);
      if (error) throw error;
      await localDatabase.saveSavingsGoal(payload, 'synced');
      return { queued: false, id };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.saveSavingsGoal(payload, 'pending_update');
      return { queued: true, id };
    }
  },

  async deleteSavingsGoal(userId, id) {
    await localDatabase.initialize();
    try {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id);
      if (error) throw error;
      await localDatabase.removeSavingsGoal(id);
      return { queued: false, id };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.markSavingsGoalDeleted(id, userId, 'pending_delete');
      return { queued: true, id };
    }
  },
};

export default savingsGoalService;
