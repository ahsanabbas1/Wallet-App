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
      console.error('refreshBudgets error:', error);
      return { refreshed: false, error };
    }
  },

  async refreshSavingsGoals(userId) {
    await this.initialize();
    try {
      await this.syncPendingSavingsGoals(userId);
      await pullSavingsGoals(userId);
      return { refreshed: true };
    } catch (error) {
      console.error('refreshSavingsGoals error:', error);
      return { refreshed: false, error };
    }
  },

  async refreshAll(userId) {
    await this.initialize();
    await Promise.allSettled([
      this.refreshBudgets(userId),
      this.refreshSavingsGoals(userId),
      this.refreshShopping(userId),
      this.refreshLoans(userId),
      this.refreshPlannedPayments(userId),
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

// ─── Shopping pull helpers ────────────────────────────────────────────────────

async function pullShoppingLists(userId) {
  const { data, error } = await supabase.from('shopping_lists').select('*').eq('user_id', userId);
  if (error) throw error;
  await localDatabase.upsertRemoteShoppingLists(data || []);
  return data || [];
}

async function pullShoppingItems(userId) {
  // Fetch items belonging to any list owned by this user
  const { data: lists } = await supabase.from('shopping_lists').select('id').eq('user_id', userId);
  if (!lists || lists.length === 0) return [];
  const listIds = lists.map(l => l.id);
  const { data, error } = await supabase.from('shopping_items').select('*').in('list_id', listIds);
  if (error) throw error;
  await localDatabase.upsertRemoteShoppingItems(data || []);
  return data || [];
}

async function pullWarranties(userId) {
  const { data, error } = await supabase.from('warranties').select('*').eq('user_id', userId);
  if (error) throw error;
  await localDatabase.upsertRemoteWarranties(data || []);
  return data || [];
}

// ─── Shopping push helpers ────────────────────────────────────────────────────

async function pushPendingShoppingList(item) {
  const payload = {
    id: item.id, user_id: item.user_id, title: item.title,
    is_archived: item.is_archived ?? false, created_at: item.created_at,
  };
  if (item.sync_status === 'pending_create') {
    const { error } = await supabase.from('shopping_lists').insert(payload);
    if (error) throw error;
    await localDatabase.markShoppingListSynced(item.id);
    return;
  }
  if (item.sync_status === 'pending_update') {
    const { error } = await supabase.from('shopping_lists').update({ title: payload.title, is_archived: payload.is_archived }).eq('id', item.id);
    if (error) throw error;
    await localDatabase.markShoppingListSynced(item.id);
    return;
  }
  if (item.sync_status === 'pending_delete') {
    const { error } = await supabase.from('shopping_lists').delete().eq('id', item.id);
    if (error) throw error;
    await localDatabase.removeShoppingList(item.id);
  }
}

async function pushPendingShoppingItem(item) {
  const payload = {
    id: item.id, list_id: item.list_id, name: item.name,
    description: item.description ?? null, quantity: item.quantity ?? 1,
    price: item.price ?? null, is_completed: item.is_completed ?? false,
    created_at: item.created_at,
  };
  if (item.sync_status === 'pending_create') {
    const { error } = await supabase.from('shopping_items').insert(payload);
    if (error) throw error;
    await localDatabase.markShoppingItemSynced(item.id);
    return;
  }
  if (item.sync_status === 'pending_update') {
    const { error } = await supabase.from('shopping_items').update({ name: payload.name, description: payload.description, quantity: payload.quantity, price: payload.price, is_completed: payload.is_completed }).eq('id', item.id);
    if (error) throw error;
    await localDatabase.markShoppingItemSynced(item.id);
    return;
  }
  if (item.sync_status === 'pending_delete') {
    const { error } = await supabase.from('shopping_items').delete().eq('id', item.id);
    if (error) throw error;
    await localDatabase.removeShoppingItem(item.id);
  }
}

async function pushPendingWarranty(item) {
  const payload = {
    id: item.id, user_id: item.user_id, name: item.name,
    purchase_date: item.purchase_date ?? null, expiry_date: item.expiry_date ?? null,
    color: item.color ?? null, created_at: item.created_at,
  };
  if (item.sync_status === 'pending_create') {
    const { error } = await supabase.from('warranties').insert(payload);
    if (error) throw error;
    await localDatabase.markWarrantySynced(item.id);
    return;
  }
  if (item.sync_status === 'pending_update') {
    const { error } = await supabase.from('warranties').update({ name: payload.name, purchase_date: payload.purchase_date, expiry_date: payload.expiry_date, color: payload.color }).eq('id', item.id);
    if (error) throw error;
    await localDatabase.markWarrantySynced(item.id);
    return;
  }
  if (item.sync_status === 'pending_delete') {
    const { error } = await supabase.from('warranties').delete().eq('id', item.id);
    if (error) throw error;
    await localDatabase.removeWarranty(item.id);
  }
}

// ─── Loan pull helpers ────────────────────────────────────────────────────────

async function pullLoans(userId) {
  const { data, error } = await supabase.from('loans').select('*').eq('user_id', userId).order('date', { ascending: false });
  if (error) throw error;
  await localDatabase.upsertRemoteLoans(data || []);
  return data || [];
}

async function pullLoanPayments(userId) {
  const { data: loans } = await supabase.from('loans').select('id').eq('user_id', userId);
  if (!loans || loans.length === 0) return [];
  const loanIds = loans.map(l => l.id);
  const { data, error } = await supabase.from('loan_payments').select('*').in('loan_id', loanIds);
  if (error) throw error;
  await localDatabase.upsertRemoteLoanPayments(data || []);
  return data || [];
}

// ─── Loan push helpers ────────────────────────────────────────────────────────

async function pushPendingLoan(item) {
  const payload = {
    id: item.id, user_id: item.user_id, type: item.type,
    person_name: item.person_name, total_amount: Number(item.total_amount),
    date: item.date, notes: item.notes ?? null,
    is_settled: item.is_settled ?? false, created_at: item.created_at,
  };
  if (item.sync_status === 'pending_create') {
    const { error } = await supabase.from('loans').insert(payload);
    if (error) throw error;
    await localDatabase.markLoanSynced(item.id);
    return;
  }
  if (item.sync_status === 'pending_update') {
    const { error } = await supabase.from('loans').update({ type: payload.type, person_name: payload.person_name, total_amount: payload.total_amount, date: payload.date, notes: payload.notes, is_settled: payload.is_settled }).eq('id', item.id);
    if (error) throw error;
    await localDatabase.markLoanSynced(item.id);
    return;
  }
  if (item.sync_status === 'pending_delete') {
    const { error } = await supabase.from('loans').delete().eq('id', item.id);
    if (error) throw error;
    await localDatabase.removeLoan(item.id);
  }
}

async function pushPendingLoanPayment(item) {
  const payload = {
    id: item.id, loan_id: item.loan_id, amount: Number(item.amount),
    date: item.date, notes: item.notes ?? null, created_at: item.created_at,
  };
  if (item.sync_status === 'pending_create') {
    const { error } = await supabase.from('loan_payments').insert(payload);
    if (error) throw error;
    await localDatabase.markLoanPaymentSynced(item.id);
    return;
  }
  if (item.sync_status === 'pending_update') {
    const { error } = await supabase.from('loan_payments').update({ amount: payload.amount, date: payload.date, notes: payload.notes }).eq('id', item.id);
    if (error) throw error;
    await localDatabase.markLoanPaymentSynced(item.id);
    return;
  }
  if (item.sync_status === 'pending_delete') {
    const { error } = await supabase.from('loan_payments').delete().eq('id', item.id);
    if (error) throw error;
    await localDatabase.removeLoanPayment(item.id);
  }
}

async function pullPlannedPayments(userId) {
  const { data, error } = await supabase.from('planned_payments').select('*').eq('user_id', userId);
  if (error) throw error;
  await localDatabase.upsertRemotePlannedPayments(data || []);
  return data || [];
}

async function pushPendingPlannedPayment(item) {
  const payload = {
    id: item.id, user_id: item.user_id, category_id: item.category_id || null,
    title: item.title, amount: Number(item.amount), type: item.type,
    frequency: item.frequency, next_date: item.next_date,
    start_date: item.start_date || null, end_date: item.end_date || null,
    description: item.description || null, is_active: !!item.is_active,
  };
  if (item.sync_status === 'pending_create') {
    const { error } = await supabase.from('planned_payments').insert(payload);
    if (error) throw error;
    await localDatabase.markPlannedPaymentSynced(item.id);
    return;
  }
  if (item.sync_status === 'pending_update') {
    const { error } = await supabase.from('planned_payments').update({
      title: payload.title, amount: payload.amount, type: payload.type,
      frequency: payload.frequency, next_date: payload.next_date,
      start_date: payload.start_date, end_date: payload.end_date,
      description: payload.description, is_active: payload.is_active,
      category_id: payload.category_id
    }).eq('id', item.id);
    if (error) throw error;
    await localDatabase.markPlannedPaymentSynced(item.id);
    return;
  }
  if (item.sync_status === 'pending_delete') {
    const { error } = await supabase.from('planned_payments').delete().eq('id', item.id);
    if (error) throw error;
    await localDatabase.removePlannedPayment(item.id);
  }
}

// ─── Append shopping + loan methods to the exported service object ────────────

Object.assign(financeSyncService, {

  async refreshPlannedPayments(userId) {
    await this.initialize();
    try {
      await this.syncPendingPlannedPayments(userId);
      await pullPlannedPayments(userId);
      return { refreshed: true };
    } catch (error) {
      console.error('refreshPlannedPayments error:', error);
      return { refreshed: false, error };
    }
  },

  async syncPendingPlannedPayments(userId) {
    await this.initialize();
    const pending = await localDatabase.getPendingPlannedPayments(userId);
    let synced = 0; let failed = 0;
    for (const row of pending) {
      try { await pushPendingPlannedPayment(row); synced++; }
      catch (e) { failed++; if (isNetworkError(e)) break; }
    }
    return { synced, failed };
  },

  async refreshShopping(userId) {
    await this.initialize();
    try {
      await this.syncPendingShopping(userId);
      await Promise.all([
        pullShoppingLists(userId),
        pullShoppingItems(userId),
        pullWarranties(userId),
      ]);
      return { refreshed: true };
    } catch (error) {
      console.error('refreshShopping error:', error);
      return { refreshed: false, error };
    }
  },

  async refreshLoans(userId) {
    await this.initialize();
    try {
      await this.syncPendingLoans(userId);
      await Promise.all([
        pullLoans(userId),
        pullLoanPayments(userId),
      ]);
      return { refreshed: true };
    } catch (error) {
      console.error('refreshLoans error:', error);
      return { refreshed: false, error };
    }
  },

  async syncPendingShopping(userId) {
    await this.initialize();
    let synced = 0; let failed = 0;

    const [lists, items, warranties] = await Promise.all([
      localDatabase.getPendingShoppingLists(userId),
      localDatabase.getPendingShoppingItems(),
      localDatabase.getPendingWarranties(userId),
    ]);

    for (const row of lists) {
      try { await pushPendingShoppingList(row); synced++; }
      catch (e) { failed++; if (isNetworkError(e)) break; }
    }
    for (const row of items) {
      try { await pushPendingShoppingItem(row); synced++; }
      catch (e) { failed++; if (isNetworkError(e)) break; }
    }
    for (const row of warranties) {
      try { await pushPendingWarranty(row); synced++; }
      catch (e) { failed++; if (isNetworkError(e)) break; }
    }
    return { synced, failed };
  },

  async syncPendingLoans(userId) {
    await this.initialize();
    let synced = 0; let failed = 0;

    const [loans, payments] = await Promise.all([
      localDatabase.getPendingLoans(userId),
      localDatabase.getPendingLoanPayments(userId),
    ]);

    for (const row of loans) {
      try { await pushPendingLoan(row); synced++; }
      catch (e) { failed++; if (isNetworkError(e)) break; }
    }
    for (const row of payments) {
      try { await pushPendingLoanPayment(row); synced++; }
      catch (e) { failed++; if (isNetworkError(e)) break; }
    }
    return { synced, failed };
  },
});

export default financeSyncService;
