import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  CATEGORIES:      'web_local_categories',
  TRANSACTIONS:    'web_local_transactions',
  BUDGETS:         'web_local_budgets',
  GOALS:           'web_local_goals',
  SHOPPING_LISTS:  'web_local_shopping_lists',
  SHOPPING_ITEMS:  'web_local_shopping_items',
  WARRANTIES:      'web_local_warranties',
  LOANS:           'web_local_loans',
  LOAN_PAYMENTS:   'web_local_loan_payments',
  PROFILE:         'web_local_profile',
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

  mapBudgetRow(row)      { return row; },
  mapSavingsGoalRow(row) { return row; },

  // ── User Profile ──────────────────────────────────────────────────────────

  async getProfile(userId) {
    const all = await readJson(KEYS.PROFILE, {});
    return all[userId] || null;
  },

  async saveProfile(userId, profile) {
    const all = await readJson(KEYS.PROFILE, {});
    all[userId] = { ...all[userId], ...profile };
    await writeJson(KEYS.PROFILE, all);
  },

  // ── Shopping Lists ────────────────────────────────────────────────────────

  async getShoppingLists(userId) {
    const rows = await readJson(KEYS.SHOPPING_LISTS, []);
    return rows
      .filter(r => r.user_id === userId && !r.deleted_at)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  },

  async saveShoppingList(list, syncStatus = 'synced') {
    const rows = await readJson(KEYS.SHOPPING_LISTS, []);
    const next = rows.filter(r => r.id !== list.id);
    next.push({ ...list, sync_status: syncStatus, locally_modified_at: nowIso(), deleted_at: null });
    await writeJson(KEYS.SHOPPING_LISTS, next);
  },

  async upsertRemoteShoppingLists(lists) {
    const existing = await readJson(KEYS.SHOPPING_LISTS, []);
    const byId = new Map(existing.map(r => [r.id, r]));
    for (const item of lists || []) {
      const cur = byId.get(item.id);
      if (cur?.sync_status?.startsWith('pending_')) continue;
      byId.set(item.id, { ...cur, ...item, sync_status: 'synced', last_synced_at: nowIso() });
    }
    await writeJson(KEYS.SHOPPING_LISTS, Array.from(byId.values()));
  },

  async deleteShoppingList(id, userId) {
    const rows = await readJson(KEYS.SHOPPING_LISTS, []);
    await writeJson(KEYS.SHOPPING_LISTS,
      rows.map(r => r.id === id && r.user_id === userId
        ? { ...r, deleted_at: nowIso(), sync_status: 'pending_delete', locally_modified_at: nowIso() }
        : r));
  },

  async removeShoppingList(id) {
    const rows = await readJson(KEYS.SHOPPING_LISTS, []);
    await writeJson(KEYS.SHOPPING_LISTS, rows.filter(r => r.id !== id));
  },

  async getPendingShoppingLists(userId) {
    const rows = await readJson(KEYS.SHOPPING_LISTS, []);
    return rows.filter(r => r.user_id === userId && r.sync_status?.startsWith('pending_'));
  },

  async markShoppingListSynced(id) {
    const rows = await readJson(KEYS.SHOPPING_LISTS, []);
    await writeJson(KEYS.SHOPPING_LISTS,
      rows.map(r => r.id === id ? { ...r, sync_status: 'synced', deleted_at: null, last_synced_at: nowIso() } : r));
  },

  // ── Shopping Items ────────────────────────────────────────────────────────

  async getShoppingListById(listId) {
    const rows = await readJson(KEYS.SHOPPING_LISTS, []);
    return rows.find(r => r.id === listId && !r.deleted_at) || null;
  },

  async getShoppingItems(listId) {
    const rows = await readJson(KEYS.SHOPPING_ITEMS, []);
    return rows
      .filter(r => r.list_id === listId && !r.deleted_at)
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  },

  async getAllShoppingItems(userId) {
    // Used for bulk operations
    const rows = await readJson(KEYS.SHOPPING_ITEMS, []);
    return rows.filter(r => r.user_id === userId && !r.deleted_at);
  },

  async saveShoppingItem(item, syncStatus = 'synced') {
    const rows = await readJson(KEYS.SHOPPING_ITEMS, []);
    const next = rows.filter(r => r.id !== item.id);
    next.push({ ...item, sync_status: syncStatus, locally_modified_at: nowIso(), deleted_at: null });
    await writeJson(KEYS.SHOPPING_ITEMS, next);
  },

  async upsertRemoteShoppingItems(items) {
    const existing = await readJson(KEYS.SHOPPING_ITEMS, []);
    const byId = new Map(existing.map(r => [r.id, r]));
    for (const item of items || []) {
      const cur = byId.get(item.id);
      if (cur?.sync_status?.startsWith('pending_')) continue;
      byId.set(item.id, { ...cur, ...item, sync_status: 'synced', last_synced_at: nowIso() });
    }
    await writeJson(KEYS.SHOPPING_ITEMS, Array.from(byId.values()));
  },

  async deleteShoppingItem(id) {
    const rows = await readJson(KEYS.SHOPPING_ITEMS, []);
    await writeJson(KEYS.SHOPPING_ITEMS,
      rows.map(r => r.id === id
        ? { ...r, deleted_at: nowIso(), sync_status: 'pending_delete', locally_modified_at: nowIso() }
        : r));
  },

  async removeShoppingItem(id) {
    const rows = await readJson(KEYS.SHOPPING_ITEMS, []);
    await writeJson(KEYS.SHOPPING_ITEMS, rows.filter(r => r.id !== id));
  },

  async getPendingShoppingItems() {
    const rows = await readJson(KEYS.SHOPPING_ITEMS, []);
    return rows.filter(r => r.sync_status?.startsWith('pending_'));
  },

  async markShoppingItemSynced(id) {
    const rows = await readJson(KEYS.SHOPPING_ITEMS, []);
    await writeJson(KEYS.SHOPPING_ITEMS,
      rows.map(r => r.id === id ? { ...r, sync_status: 'synced', deleted_at: null, last_synced_at: nowIso() } : r));
  },

  // ── Warranties ────────────────────────────────────────────────────────────

  async getWarranties(userId) {
    const rows = await readJson(KEYS.WARRANTIES, []);
    return rows
      .filter(r => r.user_id === userId && !r.deleted_at)
      .sort((a, b) => new Date(a.expiry_date || 0) - new Date(b.expiry_date || 0));
  },

  async saveWarranty(warranty, syncStatus = 'synced') {
    const rows = await readJson(KEYS.WARRANTIES, []);
    const next = rows.filter(r => r.id !== warranty.id);
    next.push({ ...warranty, sync_status: syncStatus, locally_modified_at: nowIso(), deleted_at: null });
    await writeJson(KEYS.WARRANTIES, next);
  },

  async upsertRemoteWarranties(warranties) {
    const existing = await readJson(KEYS.WARRANTIES, []);
    const byId = new Map(existing.map(r => [r.id, r]));
    for (const w of warranties || []) {
      const cur = byId.get(w.id);
      if (cur?.sync_status?.startsWith('pending_')) continue;
      byId.set(w.id, { ...cur, ...w, sync_status: 'synced', last_synced_at: nowIso() });
    }
    await writeJson(KEYS.WARRANTIES, Array.from(byId.values()));
  },

  async deleteWarranty(id, userId) {
    const rows = await readJson(KEYS.WARRANTIES, []);
    await writeJson(KEYS.WARRANTIES,
      rows.map(r => r.id === id && r.user_id === userId
        ? { ...r, deleted_at: nowIso(), sync_status: 'pending_delete', locally_modified_at: nowIso() }
        : r));
  },

  async removeWarranty(id) {
    const rows = await readJson(KEYS.WARRANTIES, []);
    await writeJson(KEYS.WARRANTIES, rows.filter(r => r.id !== id));
  },

  async getPendingWarranties(userId) {
    const rows = await readJson(KEYS.WARRANTIES, []);
    return rows.filter(r => r.user_id === userId && r.sync_status?.startsWith('pending_'));
  },

  async markWarrantySynced(id) {
    const rows = await readJson(KEYS.WARRANTIES, []);
    await writeJson(KEYS.WARRANTIES,
      rows.map(r => r.id === id ? { ...r, sync_status: 'synced', deleted_at: null, last_synced_at: nowIso() } : r));
  },

  // ── Loans ─────────────────────────────────────────────────────────────────

  async getLoans(userId) {
    const rows = await readJson(KEYS.LOANS, []);
    return rows
      .filter(r => r.user_id === userId && !r.deleted_at)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  },

  async saveLoan(loan, syncStatus = 'synced') {
    const rows = await readJson(KEYS.LOANS, []);
    const next = rows.filter(r => r.id !== loan.id);
    next.push({ ...loan, sync_status: syncStatus, locally_modified_at: nowIso(), deleted_at: null });
    await writeJson(KEYS.LOANS, next);
  },

  async upsertRemoteLoans(loans) {
    const existing = await readJson(KEYS.LOANS, []);
    const byId = new Map(existing.map(r => [r.id, r]));
    for (const loan of loans || []) {
      const cur = byId.get(loan.id);
      if (cur?.sync_status?.startsWith('pending_')) continue;
      byId.set(loan.id, { ...cur, ...loan, sync_status: 'synced', last_synced_at: nowIso() });
    }
    await writeJson(KEYS.LOANS, Array.from(byId.values()));
  },

  async deleteLoan(id, userId) {
    const rows = await readJson(KEYS.LOANS, []);
    await writeJson(KEYS.LOANS,
      rows.map(r => r.id === id && r.user_id === userId
        ? { ...r, deleted_at: nowIso(), sync_status: 'pending_delete', locally_modified_at: nowIso() }
        : r));
  },

  async removeLoan(id) {
    const rows = await readJson(KEYS.LOANS, []);
    await writeJson(KEYS.LOANS, rows.filter(r => r.id !== id));
  },

  async getPendingLoans(userId) {
    const rows = await readJson(KEYS.LOANS, []);
    return rows.filter(r => r.user_id === userId && r.sync_status?.startsWith('pending_'));
  },

  async markLoanSynced(id) {
    const rows = await readJson(KEYS.LOANS, []);
    await writeJson(KEYS.LOANS,
      rows.map(r => r.id === id ? { ...r, sync_status: 'synced', deleted_at: null, last_synced_at: nowIso() } : r));
  },

  // ── Loan Payments ─────────────────────────────────────────────────────────

  async getLoanPayments(loanId) {
    const rows = await readJson(KEYS.LOAN_PAYMENTS, []);
    return rows
      .filter(r => r.loan_id === loanId && !r.deleted_at)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  },

  async getAllLoanPayments(userId) {
    const loans = await readJson(KEYS.LOANS, []);
    const userLoanIds = new Set(loans.filter(l => l.user_id === userId).map(l => l.id));
    const rows = await readJson(KEYS.LOAN_PAYMENTS, []);
    return rows.filter(r => userLoanIds.has(r.loan_id) && !r.deleted_at);
  },

  async saveLoanPayment(payment, syncStatus = 'synced') {
    const rows = await readJson(KEYS.LOAN_PAYMENTS, []);
    const next = rows.filter(r => r.id !== payment.id);
    next.push({ ...payment, sync_status: syncStatus, locally_modified_at: nowIso(), deleted_at: null });
    await writeJson(KEYS.LOAN_PAYMENTS, next);
  },

  async upsertRemoteLoanPayments(payments) {
    const existing = await readJson(KEYS.LOAN_PAYMENTS, []);
    const byId = new Map(existing.map(r => [r.id, r]));
    for (const p of payments || []) {
      const cur = byId.get(p.id);
      if (cur?.sync_status?.startsWith('pending_')) continue;
      byId.set(p.id, { ...cur, ...p, sync_status: 'synced', last_synced_at: nowIso() });
    }
    await writeJson(KEYS.LOAN_PAYMENTS, Array.from(byId.values()));
  },

  async deleteLoanPayment(id) {
    const rows = await readJson(KEYS.LOAN_PAYMENTS, []);
    await writeJson(KEYS.LOAN_PAYMENTS,
      rows.map(r => r.id === id
        ? { ...r, deleted_at: nowIso(), sync_status: 'pending_delete', locally_modified_at: nowIso() }
        : r));
  },

  async removeLoanPayment(id) {
    const rows = await readJson(KEYS.LOAN_PAYMENTS, []);
    await writeJson(KEYS.LOAN_PAYMENTS, rows.filter(r => r.id !== id));
  },

  async getPendingLoanPayments(userId) {
    const loans = await readJson(KEYS.LOANS, []);
    const userLoanIds = new Set(loans.filter(l => l.user_id === userId).map(l => l.id));
    const rows = await readJson(KEYS.LOAN_PAYMENTS, []);
    return rows.filter(r => userLoanIds.has(r.loan_id) && r.sync_status?.startsWith('pending_'));
  },

  async markLoanPaymentSynced(id) {
    const rows = await readJson(KEYS.LOAN_PAYMENTS, []);
    await writeJson(KEYS.LOAN_PAYMENTS,
      rows.map(r => r.id === id ? { ...r, sync_status: 'synced', deleted_at: null, last_synced_at: nowIso() } : r));
  },
};

export default localDatabase;
