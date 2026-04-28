import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  CATEGORIES: 'web_local_categories',
  TRANSACTIONS: 'web_local_transactions',
  BUDGETS: 'web_local_budgets',
  GOALS: 'web_local_goals',
};

function nowIso() {
  return new Date().toISOString();
}

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const localDatabase = {
  async initialize() {
    return true;
  },

  async replaceCategories(categories) {
    await writeJson(KEYS.CATEGORIES, Array.isArray(categories) ? categories : []);
  },

  async getCategories(userId) {
    const rows = await readJson(KEYS.CATEGORIES, []);
    return rows
      .filter((item) => item.user_id === userId || item.user_id == null)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },

  async upsertRemoteTransactions(transactions) {
    const existing = await readJson(KEYS.TRANSACTIONS, []);
    const byId = new Map(existing.map((item) => [item.id, item]));

    for (const transaction of transactions || []) {
      const current = byId.get(transaction.id);
      if (current?.sync_status === 'pending_update' || current?.sync_status === 'pending_delete') {
        continue;
      }
      byId.set(transaction.id, {
        ...current,
        ...transaction,
        sync_status: current?.sync_status || 'synced',
        sync_error: current?.sync_status ? current.sync_error : null,
        last_synced_at: nowIso(),
      });
    }

    await writeJson(KEYS.TRANSACTIONS, Array.from(byId.values()));
  },

  async upsertRemoteBudgets(budgets) {
    const existing = await readJson(KEYS.BUDGETS, []);
    const byId = new Map(existing.map((item) => [item.id, item]));
    for (const budget of budgets || []) {
      const current = byId.get(budget.id);
      if (current?.sync_status === 'pending_update' || current?.sync_status === 'pending_delete') continue;
      byId.set(budget.id, {
        ...current,
        ...budget,
        sync_status: current?.sync_status || 'synced',
        sync_error: current?.sync_status ? current.sync_error : null,
        last_synced_at: nowIso(),
      });
    }
    await writeJson(KEYS.BUDGETS, Array.from(byId.values()));
  },

  async getBudgets(userId) {
    const rows = await readJson(KEYS.BUDGETS, []);
    return rows.filter((item) => item.user_id === userId && !item.deleted_at);
  },

  async saveBudget(budget, syncStatus = 'synced') {
    const rows = await readJson(KEYS.BUDGETS, []);
    const next = rows.filter((item) => item.id !== budget.id);
    next.push({
      ...budget,
      total_amount: normalizeNumber(budget.total_amount),
      sync_status: syncStatus,
      sync_error: null,
      last_synced_at: syncStatus === 'synced' ? nowIso() : null,
      locally_modified_at: nowIso(),
      deleted_at: null,
    });
    await writeJson(KEYS.BUDGETS, next);
  },

  async markBudgetDeleted(id, userId, syncStatus = 'pending_delete') {
    const rows = await readJson(KEYS.BUDGETS, []);
    await writeJson(
      KEYS.BUDGETS,
      rows.map((item) =>
        item.id === id && item.user_id === userId
          ? { ...item, deleted_at: nowIso(), sync_status: syncStatus, locally_modified_at: nowIso() }
          : item
      )
    );
  },

  async removeBudget(id) {
    const rows = await readJson(KEYS.BUDGETS, []);
    await writeJson(KEYS.BUDGETS, rows.filter((item) => item.id !== id));
  },

  async markBudgetSynced(id) {
    const rows = await readJson(KEYS.BUDGETS, []);
    await writeJson(
      KEYS.BUDGETS,
      rows.map((item) =>
        item.id === id
          ? { ...item, sync_status: 'synced', sync_error: null, deleted_at: null, last_synced_at: nowIso(), locally_modified_at: nowIso() }
          : item
      )
    );
  },

  async markBudgetSyncError(id, message) {
    const rows = await readJson(KEYS.BUDGETS, []);
    await writeJson(KEYS.BUDGETS, rows.map((item) => (item.id === id ? { ...item, sync_error: message ?? 'Sync failed' } : item)));
  },

  async getPendingBudgets(userId) {
    const rows = await readJson(KEYS.BUDGETS, []);
    return rows.filter((item) => item.user_id === userId && ['pending_create', 'pending_update', 'pending_delete'].includes(item.sync_status));
  },

  async upsertRemoteSavingsGoals(goals) {
    const existing = await readJson(KEYS.GOALS, []);
    const byId = new Map(existing.map((item) => [item.id, item]));
    for (const goal of goals || []) {
      const current = byId.get(goal.id);
      if (current?.sync_status === 'pending_update' || current?.sync_status === 'pending_delete') continue;
      byId.set(goal.id, {
        ...current,
        ...goal,
        sync_status: current?.sync_status || 'synced',
        sync_error: current?.sync_status ? current.sync_error : null,
        last_synced_at: nowIso(),
      });
    }
    await writeJson(KEYS.GOALS, Array.from(byId.values()));
  },

  async getSavingsGoals(userId) {
    const rows = await readJson(KEYS.GOALS, []);
    return rows.filter((item) => item.user_id === userId && !item.deleted_at).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  },

  async saveSavingsGoal(goal, syncStatus = 'synced') {
    const rows = await readJson(KEYS.GOALS, []);
    const next = rows.filter((item) => item.id !== goal.id);
    next.push({
      ...goal,
      target_amount: normalizeNumber(goal.target_amount),
      saved_amount: normalizeNumber(goal.saved_amount ?? 0),
      sync_status: syncStatus,
      sync_error: null,
      last_synced_at: syncStatus === 'synced' ? nowIso() : null,
      locally_modified_at: nowIso(),
      deleted_at: null,
    });
    await writeJson(KEYS.GOALS, next);
  },

  async markSavingsGoalDeleted(id, userId, syncStatus = 'pending_delete') {
    const rows = await readJson(KEYS.GOALS, []);
    await writeJson(
      KEYS.GOALS,
      rows.map((item) =>
        item.id === id && item.user_id === userId
          ? { ...item, deleted_at: nowIso(), sync_status: syncStatus, locally_modified_at: nowIso() }
          : item
      )
    );
  },

  async removeSavingsGoal(id) {
    const rows = await readJson(KEYS.GOALS, []);
    await writeJson(KEYS.GOALS, rows.filter((item) => item.id !== id));
  },

  async markSavingsGoalSynced(id) {
    const rows = await readJson(KEYS.GOALS, []);
    await writeJson(
      KEYS.GOALS,
      rows.map((item) =>
        item.id === id
          ? { ...item, sync_status: 'synced', sync_error: null, deleted_at: null, last_synced_at: nowIso(), locally_modified_at: nowIso() }
          : item
      )
    );
  },

  async markSavingsGoalSyncError(id, message) {
    const rows = await readJson(KEYS.GOALS, []);
    await writeJson(KEYS.GOALS, rows.map((item) => (item.id === id ? { ...item, sync_error: message ?? 'Sync failed' } : item)));
  },

  async getPendingSavingsGoals(userId) {
    const rows = await readJson(KEYS.GOALS, []);
    return rows.filter((item) => item.user_id === userId && ['pending_create', 'pending_update', 'pending_delete'].includes(item.sync_status));
  },

  async getTransactions(userId) {
    const rows = await readJson(KEYS.TRANSACTIONS, []);
    return rows
      .filter((item) => item.user_id === userId && !item.deleted_at)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  async saveTransaction(transaction, syncStatus = 'synced') {
    const rows = await readJson(KEYS.TRANSACTIONS, []);
    const next = rows.filter((item) => item.id !== transaction.id);
    next.push({
      ...transaction,
      amount: normalizeNumber(transaction.amount),
      sync_status: syncStatus,
      sync_error: null,
      last_synced_at: syncStatus === 'synced' ? nowIso() : null,
      locally_modified_at: nowIso(),
      deleted_at: null,
    });
    await writeJson(KEYS.TRANSACTIONS, next);
  },

  async markTransactionDeleted(id, userId, syncStatus = 'pending_delete') {
    const rows = await readJson(KEYS.TRANSACTIONS, []);
    await writeJson(
      KEYS.TRANSACTIONS,
      rows.map((item) =>
        item.id === id && item.user_id === userId
          ? {
              ...item,
              deleted_at: nowIso(),
              sync_status: syncStatus,
              locally_modified_at: nowIso(),
            }
          : item
      )
    );
  },

  async removeTransaction(id) {
    const rows = await readJson(KEYS.TRANSACTIONS, []);
    await writeJson(KEYS.TRANSACTIONS, rows.filter((item) => item.id !== id));
  },

  async markTransactionSynced(id) {
    const rows = await readJson(KEYS.TRANSACTIONS, []);
    await writeJson(
      KEYS.TRANSACTIONS,
      rows.map((item) =>
        item.id === id
          ? {
              ...item,
              sync_status: 'synced',
              sync_error: null,
              deleted_at: null,
              last_synced_at: nowIso(),
              locally_modified_at: nowIso(),
            }
          : item
      )
    );
  },

  async markTransactionSyncError(id, message) {
    const rows = await readJson(KEYS.TRANSACTIONS, []);
    await writeJson(
      KEYS.TRANSACTIONS,
      rows.map((item) =>
        item.id === id
          ? {
              ...item,
              sync_error: message ?? 'Sync failed',
            }
          : item
      )
    );
  },

  async getPendingTransactions(userId) {
    const rows = await readJson(KEYS.TRANSACTIONS, []);
    return rows
      .filter(
        (item) =>
          item.user_id === userId &&
          ['pending_create', 'pending_update', 'pending_delete'].includes(item.sync_status)
      )
      .sort((a, b) => new Date(a.locally_modified_at || 0) - new Date(b.locally_modified_at || 0));
  },

  mapTransactionRow(row) {
    return row;
  },

  mapBudgetRow(row) {
    return row;
  },

  mapSavingsGoalRow(row) {
    return row;
  },
};

export default localDatabase;
