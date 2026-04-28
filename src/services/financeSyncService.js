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

async function pullBudgets(userId) {
  const { data, error } = await supabase
    .from('budgets')
    .select('id, user_id, category_id, total_amount, period, created_at')
    .eq('user_id', userId);
  if (error) throw error;
  await localDatabase.upsertRemoteBudgets(data || []);
  return data || [];
}

async function pullSavingsGoals(userId) {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('id, user_id, title, target_amount, saved_amount, icon, color, start_date, target_date, repeat_basis, repeat_value, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  await localDatabase.upsertRemoteSavingsGoals(data || []);
  return data || [];
}

async function pushPendingBudget(budget) {
  const payload = {
    id: budget.id,
    user_id: budget.user_id,
    category_id: budget.category_id,
    total_amount: Number(budget.total_amount),
    period: budget.period,
    created_at: budget.created_at,
  };

  if (budget.sync_status === 'pending_create') {
    const { error } = await supabase.from('budgets').insert(payload);
    if (error) throw error;
    await localDatabase.markBudgetSynced(budget.id);
    return;
  }

  if (budget.sync_status === 'pending_update') {
    const { error } = await supabase
      .from('budgets')
      .update({
        category_id: payload.category_id,
        total_amount: payload.total_amount,
        period: payload.period,
      })
      .eq('id', budget.id);
    if (error) throw error;
    await localDatabase.markBudgetSynced(budget.id);
    return;
  }

  if (budget.sync_status === 'pending_delete') {
    const { error } = await supabase.from('budgets').delete().eq('id', budget.id);
    if (error) throw error;
    await localDatabase.removeBudget(budget.id);
  }
}

async function pushPendingSavingsGoal(goal) {
  const payload = {
    id: goal.id,
    user_id: goal.user_id,
    title: goal.title,
    target_amount: Number(goal.target_amount),
    saved_amount: Number(goal.saved_amount ?? 0),
    icon: goal.icon ?? null,
    color: goal.color ?? null,
    start_date: goal.start_date ?? null,
    target_date: goal.target_date ?? null,
    repeat_basis: goal.repeat_basis ?? null,
    repeat_value: goal.repeat_value ?? null,
    created_at: goal.created_at,
  };

  if (goal.sync_status === 'pending_create') {
    const { error } = await supabase.from('savings_goals').insert(payload);
    if (error) throw error;
    await localDatabase.markSavingsGoalSynced(goal.id);
    return;
  }

  if (goal.sync_status === 'pending_update') {
    const { error } = await supabase
      .from('savings_goals')
      .update({
        title: payload.title,
        target_amount: payload.target_amount,
        saved_amount: payload.saved_amount,
        icon: payload.icon,
        color: payload.color,
        start_date: payload.start_date,
        target_date: payload.target_date,
        repeat_basis: payload.repeat_basis,
        repeat_value: payload.repeat_value,
      })
      .eq('id', goal.id);
    if (error) throw error;
    await localDatabase.markSavingsGoalSynced(goal.id);
    return;
  }

  if (goal.sync_status === 'pending_delete') {
    const { error } = await supabase.from('savings_goals').delete().eq('id', goal.id);
    if (error) throw error;
    await localDatabase.removeSavingsGoal(goal.id);
  }
}

export const financeSyncService = {
  async initialize() {
    await localDatabase.initialize();
  },

  async refreshBudgets(userId) {
    await this.initialize();
    try {
      await this.syncPendingBudgets(userId);
      await pullBudgets(userId);
      return { refreshed: true };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      return { refreshed: false };
    }
  },

  async refreshSavingsGoals(userId) {
    await this.initialize();
    try {
      await this.syncPendingSavingsGoals(userId);
      await pullSavingsGoals(userId);
      return { refreshed: true };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      return { refreshed: false };
    }
  },

  async refreshAll(userId) {
    await this.initialize();
    await Promise.allSettled([
      this.refreshBudgets(userId),
      this.refreshSavingsGoals(userId),
    ]);
  },

  async syncPendingBudgets(userId) {
    await this.initialize();
    const pending = await localDatabase.getPendingBudgets(userId);
    let synced = 0;
    let failed = 0;
    for (const budget of pending) {
      try {
        await pushPendingBudget(budget);
        synced += 1;
      } catch (error) {
        failed += 1;
        await localDatabase.markBudgetSyncError(budget.id, error?.message);
        if (isNetworkError(error)) break;
      }
    }
    return { synced, failed };
  },

  async syncPendingSavingsGoals(userId) {
    await this.initialize();
    const pending = await localDatabase.getPendingSavingsGoals(userId);
    let synced = 0;
    let failed = 0;
    for (const goal of pending) {
      try {
        await pushPendingSavingsGoal(goal);
        synced += 1;
      } catch (error) {
        failed += 1;
        await localDatabase.markSavingsGoalSyncError(goal.id, error?.message);
        if (isNetworkError(error)) break;
      }
    }
    return { synced, failed };
  },
};

export default financeSyncService;
