import * as SQLite from 'expo-sqlite';

const DB_NAME = 'wallet-local.db';

let dbPromise = null;
let initialized = false;
let initializationPromise = null;

const createSchemaSql = `
CREATE TABLE IF NOT EXISTS local_categories (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  parent_id TEXT,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  type TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS local_transactions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  category_id TEXT,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  created_at TEXT,
  remote_updated_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  sync_error TEXT,
  last_synced_at TEXT,
  locally_modified_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_local_transactions_user_date
  ON local_transactions(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_local_transactions_sync
  ON local_transactions(sync_status, user_id);

CREATE INDEX IF NOT EXISTS idx_local_categories_user
  ON local_categories(user_id, type);

CREATE TABLE IF NOT EXISTS local_budgets (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  total_amount REAL NOT NULL,
  period TEXT NOT NULL,
  created_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  sync_error TEXT,
  last_synced_at TEXT,
  locally_modified_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_local_budgets_user_period
  ON local_budgets(user_id, period);

CREATE INDEX IF NOT EXISTS idx_local_budgets_sync
  ON local_budgets(sync_status, user_id);

CREATE TABLE IF NOT EXISTS local_savings_goals (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_amount REAL NOT NULL,
  saved_amount REAL DEFAULT 0,
  icon TEXT,
  color TEXT,
  start_date TEXT,
  target_date TEXT,
  repeat_basis TEXT,
  repeat_value INTEGER,
  created_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  sync_error TEXT,
  last_synced_at TEXT,
  locally_modified_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_local_goals_user_created
  ON local_savings_goals(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_local_goals_sync
  ON local_savings_goals(sync_status, user_id);
`;

function nowIso() {
  return new Date().toISOString();
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

async function initialize() {
  if (initialized) return await getDb();
  if (initializationPromise) return await initializationPromise;

  initializationPromise = (async () => {
    const db = await getDb();

    try {
      await db.execAsync('PRAGMA journal_mode = WAL;');
    } catch {
      // If WAL mode is unavailable on a device/build, continue with default journaling.
    }

    await db.execAsync(createSchemaSql);
    initialized = true;
    return db;
  })();

  try {
    return await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const localDatabase = {
  async initialize() {
    return await initialize();
  },

  async replaceCategories(categories) {
    const db = await initialize();
    const rows = Array.isArray(categories) ? categories : [];

    for (const category of rows) {
      await db.runAsync(
        `INSERT INTO local_categories (
          id, user_id, parent_id, name, icon, color, type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          parent_id = excluded.parent_id,
          name = excluded.name,
          icon = excluded.icon,
          color = excluded.color,
          type = excluded.type,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at`,
        category.id,
        category.user_id ?? null,
        category.parent_id ?? null,
        category.name,
        category.icon ?? null,
        category.color ?? null,
        category.type ?? null,
        category.created_at ?? null,
        category.updated_at ?? category.created_at ?? null
      );
    }
  },

  async getCategories(userId) {
    const db = await initialize();
    return await db.getAllAsync(
      `SELECT *
       FROM local_categories
       WHERE user_id = ? OR user_id IS NULL
       ORDER BY name ASC`,
      userId
    );
  },

  async upsertRemoteTransactions(transactions) {
    const db = await initialize();
    const rows = Array.isArray(transactions) ? transactions : [];

    for (const transaction of rows) {
      const existing = await db.getFirstAsync(
        `SELECT sync_status
         FROM local_transactions
         WHERE id = ?`,
        transaction.id
      );

      if (existing?.sync_status === 'pending_update' || existing?.sync_status === 'pending_delete') {
        continue;
      }

      await db.runAsync(
        `INSERT INTO local_transactions (
          id, user_id, category_id, amount, type, title, description, date,
          created_at, remote_updated_at, sync_status, sync_error, last_synced_at,
          locally_modified_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL, ?, ?, NULL)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          category_id = excluded.category_id,
          amount = excluded.amount,
          type = excluded.type,
          title = excluded.title,
          description = excluded.description,
          date = excluded.date,
          created_at = excluded.created_at,
          remote_updated_at = excluded.remote_updated_at,
          sync_status = CASE
            WHEN local_transactions.sync_status IN ('pending_update', 'pending_delete')
              THEN local_transactions.sync_status
            ELSE 'synced'
          END,
          sync_error = CASE
            WHEN local_transactions.sync_status IN ('pending_update', 'pending_delete')
              THEN local_transactions.sync_error
            ELSE NULL
          END,
          last_synced_at = excluded.last_synced_at,
          locally_modified_at = CASE
            WHEN local_transactions.sync_status IN ('pending_update', 'pending_delete')
              THEN local_transactions.locally_modified_at
            ELSE excluded.locally_modified_at
          END,
          deleted_at = CASE
            WHEN local_transactions.sync_status = 'pending_delete'
              THEN local_transactions.deleted_at
            ELSE NULL
          END`,
        transaction.id,
        transaction.user_id,
        transaction.category_id ?? null,
        normalizeNumber(transaction.amount),
        transaction.type,
        transaction.title,
        transaction.description ?? null,
        transaction.date,
        transaction.created_at ?? transaction.date ?? nowIso(),
        transaction.updated_at ?? transaction.created_at ?? transaction.date ?? nowIso(),
        nowIso(),
        transaction.updated_at ?? transaction.created_at ?? transaction.date ?? nowIso()
      );
    }
  },

  async getTransactions(userId) {
    const db = await initialize();
    return await db.getAllAsync(
      `SELECT
         t.id,
         t.user_id,
         t.category_id,
         t.amount,
         t.type,
         t.title,
         t.description,
         t.date,
         t.created_at,
         t.sync_status,
         t.sync_error,
         c.name AS category_name,
         c.color AS category_color,
         c.icon AS category_icon
       FROM local_transactions t
       LEFT JOIN local_categories c ON c.id = t.category_id
       WHERE t.user_id = ?
         AND t.deleted_at IS NULL
       ORDER BY datetime(t.date) DESC`,
      userId
    );
  },

  async upsertRemoteBudgets(budgets) {
    const db = await initialize();
    const rows = Array.isArray(budgets) ? budgets : [];

    for (const budget of rows) {
      const existing = await db.getFirstAsync(
        `SELECT sync_status FROM local_budgets WHERE id = ?`,
        budget.id
      );

      if (existing?.sync_status === 'pending_update' || existing?.sync_status === 'pending_delete') {
        continue;
      }

      await db.runAsync(
        `INSERT INTO local_budgets (
          id, user_id, category_id, total_amount, period, created_at,
          sync_status, sync_error, last_synced_at, locally_modified_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'synced', NULL, ?, ?, NULL)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          category_id = excluded.category_id,
          total_amount = excluded.total_amount,
          period = excluded.period,
          created_at = excluded.created_at,
          sync_status = CASE
            WHEN local_budgets.sync_status IN ('pending_update', 'pending_delete')
              THEN local_budgets.sync_status
            ELSE 'synced'
          END,
          sync_error = CASE
            WHEN local_budgets.sync_status IN ('pending_update', 'pending_delete')
              THEN local_budgets.sync_error
            ELSE NULL
          END,
          last_synced_at = excluded.last_synced_at,
          locally_modified_at = CASE
            WHEN local_budgets.sync_status IN ('pending_update', 'pending_delete')
              THEN local_budgets.locally_modified_at
            ELSE excluded.locally_modified_at
          END,
          deleted_at = CASE
            WHEN local_budgets.sync_status = 'pending_delete'
              THEN local_budgets.deleted_at
            ELSE NULL
          END`,
        budget.id,
        budget.user_id,
        budget.category_id,
        normalizeNumber(budget.total_amount),
        budget.period,
        budget.created_at ?? nowIso(),
        nowIso(),
        budget.updated_at ?? budget.created_at ?? nowIso()
      );
    }
  },

  async getBudgets(userId) {
    const db = await initialize();
    return await db.getAllAsync(
      `SELECT
         b.id,
         b.user_id,
         b.category_id,
         b.total_amount,
         b.period,
         b.created_at,
         b.sync_status,
         b.sync_error,
         c.name AS category_name,
         c.color AS category_color,
         c.icon AS category_icon,
         c.type AS category_type
       FROM local_budgets b
       LEFT JOIN local_categories c ON c.id = b.category_id
       WHERE b.user_id = ?
         AND b.deleted_at IS NULL`,
      userId
    );
  },

  async saveBudget(budget, syncStatus = 'synced') {
    const db = await initialize();
    const timestamp = nowIso();

    await db.runAsync(
      `INSERT INTO local_budgets (
        id, user_id, category_id, total_amount, period, created_at,
        sync_status, sync_error, last_synced_at, locally_modified_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        category_id = excluded.category_id,
        total_amount = excluded.total_amount,
        period = excluded.period,
        created_at = excluded.created_at,
        sync_status = excluded.sync_status,
        sync_error = NULL,
        last_synced_at = excluded.last_synced_at,
        locally_modified_at = excluded.locally_modified_at,
        deleted_at = NULL`,
      budget.id,
      budget.user_id,
      budget.category_id,
      normalizeNumber(budget.total_amount),
      budget.period,
      budget.created_at ?? timestamp,
      syncStatus,
      syncStatus === 'synced' ? timestamp : null,
      timestamp
    );
  },

  async markBudgetDeleted(id, userId, syncStatus = 'pending_delete') {
    const db = await initialize();
    const timestamp = nowIso();
    await db.runAsync(
      `UPDATE local_budgets
       SET deleted_at = ?, sync_status = ?, locally_modified_at = ?, sync_error = NULL
       WHERE id = ? AND user_id = ?`,
      timestamp,
      syncStatus,
      timestamp,
      id,
      userId
    );
  },

  async removeBudget(id) {
    const db = await initialize();
    await db.runAsync(`DELETE FROM local_budgets WHERE id = ?`, id);
  },

  async markBudgetSynced(id) {
    const db = await initialize();
    const timestamp = nowIso();
    await db.runAsync(
      `UPDATE local_budgets
       SET sync_status = 'synced', sync_error = NULL, deleted_at = NULL,
           last_synced_at = ?, locally_modified_at = ?
       WHERE id = ?`,
      timestamp,
      timestamp,
      id
    );
  },

  async markBudgetSyncError(id, message) {
    const db = await initialize();
    await db.runAsync(`UPDATE local_budgets SET sync_error = ? WHERE id = ?`, message ?? 'Sync failed', id);
  },

  async getPendingBudgets(userId) {
    const db = await initialize();
    return await db.getAllAsync(
      `SELECT *
       FROM local_budgets
       WHERE user_id = ?
         AND sync_status IN ('pending_create', 'pending_update', 'pending_delete')
       ORDER BY datetime(locally_modified_at) ASC`,
      userId
    );
  },

  async upsertRemoteSavingsGoals(goals) {
    const db = await initialize();
    const rows = Array.isArray(goals) ? goals : [];

    for (const goal of rows) {
      const existing = await db.getFirstAsync(
        `SELECT sync_status FROM local_savings_goals WHERE id = ?`,
        goal.id
      );

      if (existing?.sync_status === 'pending_update' || existing?.sync_status === 'pending_delete') {
        continue;
      }

      await db.runAsync(
        `INSERT INTO local_savings_goals (
          id, user_id, title, target_amount, saved_amount, icon, color,
          start_date, target_date, repeat_basis, repeat_value, created_at,
          sync_status, sync_error, last_synced_at, locally_modified_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL, ?, ?, NULL)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          title = excluded.title,
          target_amount = excluded.target_amount,
          saved_amount = excluded.saved_amount,
          icon = excluded.icon,
          color = excluded.color,
          start_date = excluded.start_date,
          target_date = excluded.target_date,
          repeat_basis = excluded.repeat_basis,
          repeat_value = excluded.repeat_value,
          created_at = excluded.created_at,
          sync_status = CASE
            WHEN local_savings_goals.sync_status IN ('pending_update', 'pending_delete')
              THEN local_savings_goals.sync_status
            ELSE 'synced'
          END,
          sync_error = CASE
            WHEN local_savings_goals.sync_status IN ('pending_update', 'pending_delete')
              THEN local_savings_goals.sync_error
            ELSE NULL
          END,
          last_synced_at = excluded.last_synced_at,
          locally_modified_at = CASE
            WHEN local_savings_goals.sync_status IN ('pending_update', 'pending_delete')
              THEN local_savings_goals.locally_modified_at
            ELSE excluded.locally_modified_at
          END,
          deleted_at = CASE
            WHEN local_savings_goals.sync_status = 'pending_delete'
              THEN local_savings_goals.deleted_at
            ELSE NULL
          END`,
        goal.id,
        goal.user_id,
        goal.title,
        normalizeNumber(goal.target_amount),
        normalizeNumber(goal.saved_amount),
        goal.icon ?? null,
        goal.color ?? null,
        goal.start_date ?? null,
        goal.target_date ?? null,
        goal.repeat_basis ?? null,
        goal.repeat_value ?? null,
        goal.created_at ?? nowIso(),
        nowIso(),
        goal.updated_at ?? goal.created_at ?? nowIso()
      );
    }
  },

  async getSavingsGoals(userId) {
    const db = await initialize();
    return await db.getAllAsync(
      `SELECT *
       FROM local_savings_goals
       WHERE user_id = ?
         AND deleted_at IS NULL
       ORDER BY datetime(created_at) DESC`,
      userId
    );
  },

  async saveSavingsGoal(goal, syncStatus = 'synced') {
    const db = await initialize();
    const timestamp = nowIso();

    await db.runAsync(
      `INSERT INTO local_savings_goals (
        id, user_id, title, target_amount, saved_amount, icon, color,
        start_date, target_date, repeat_basis, repeat_value, created_at,
        sync_status, sync_error, last_synced_at, locally_modified_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        title = excluded.title,
        target_amount = excluded.target_amount,
        saved_amount = excluded.saved_amount,
        icon = excluded.icon,
        color = excluded.color,
        start_date = excluded.start_date,
        target_date = excluded.target_date,
        repeat_basis = excluded.repeat_basis,
        repeat_value = excluded.repeat_value,
        created_at = excluded.created_at,
        sync_status = excluded.sync_status,
        sync_error = NULL,
        last_synced_at = excluded.last_synced_at,
        locally_modified_at = excluded.locally_modified_at,
        deleted_at = NULL`,
      goal.id,
      goal.user_id,
      goal.title,
      normalizeNumber(goal.target_amount),
      normalizeNumber(goal.saved_amount ?? 0),
      goal.icon ?? null,
      goal.color ?? null,
      goal.start_date ?? null,
      goal.target_date ?? null,
      goal.repeat_basis ?? null,
      goal.repeat_value ?? null,
      goal.created_at ?? timestamp,
      syncStatus,
      syncStatus === 'synced' ? timestamp : null,
      timestamp
    );
  },

  async markSavingsGoalDeleted(id, userId, syncStatus = 'pending_delete') {
    const db = await initialize();
    const timestamp = nowIso();
    await db.runAsync(
      `UPDATE local_savings_goals
       SET deleted_at = ?, sync_status = ?, locally_modified_at = ?, sync_error = NULL
       WHERE id = ? AND user_id = ?`,
      timestamp,
      syncStatus,
      timestamp,
      id,
      userId
    );
  },

  async removeSavingsGoal(id) {
    const db = await initialize();
    await db.runAsync(`DELETE FROM local_savings_goals WHERE id = ?`, id);
  },

  async markSavingsGoalSynced(id) {
    const db = await initialize();
    const timestamp = nowIso();
    await db.runAsync(
      `UPDATE local_savings_goals
       SET sync_status = 'synced', sync_error = NULL, deleted_at = NULL,
           last_synced_at = ?, locally_modified_at = ?
       WHERE id = ?`,
      timestamp,
      timestamp,
      id
    );
  },

  async markSavingsGoalSyncError(id, message) {
    const db = await initialize();
    await db.runAsync(`UPDATE local_savings_goals SET sync_error = ? WHERE id = ?`, message ?? 'Sync failed', id);
  },

  async getPendingSavingsGoals(userId) {
    const db = await initialize();
    return await db.getAllAsync(
      `SELECT *
       FROM local_savings_goals
       WHERE user_id = ?
         AND sync_status IN ('pending_create', 'pending_update', 'pending_delete')
       ORDER BY datetime(locally_modified_at) ASC`,
      userId
    );
  },

  async saveTransaction(transaction, syncStatus = 'synced') {
    const db = await initialize();
    const timestamp = nowIso();

    await db.runAsync(
      `INSERT INTO local_transactions (
        id, user_id, category_id, amount, type, title, description, date,
        created_at, remote_updated_at, sync_status, sync_error, last_synced_at,
        locally_modified_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        category_id = excluded.category_id,
        amount = excluded.amount,
        type = excluded.type,
        title = excluded.title,
        description = excluded.description,
        date = excluded.date,
        created_at = excluded.created_at,
        remote_updated_at = excluded.remote_updated_at,
        sync_status = excluded.sync_status,
        sync_error = NULL,
        last_synced_at = excluded.last_synced_at,
        locally_modified_at = excluded.locally_modified_at,
        deleted_at = NULL`,
      transaction.id,
      transaction.user_id,
      transaction.category_id ?? null,
      normalizeNumber(transaction.amount),
      transaction.type,
      transaction.title,
      transaction.description ?? null,
      transaction.date,
      transaction.created_at ?? transaction.date ?? timestamp,
      transaction.updated_at ?? transaction.created_at ?? transaction.date ?? timestamp,
      syncStatus,
      syncStatus === 'synced' ? timestamp : null,
      timestamp
    );
  },

  async markTransactionDeleted(id, userId, syncStatus = 'pending_delete') {
    const db = await initialize();
    const timestamp = nowIso();

    await db.runAsync(
      `UPDATE local_transactions
       SET deleted_at = ?,
           sync_status = ?,
           locally_modified_at = ?,
           sync_error = NULL
       WHERE id = ? AND user_id = ?`,
      timestamp,
      syncStatus,
      timestamp,
      id,
      userId
    );
  },

  async removeTransaction(id) {
    const db = await initialize();
    await db.runAsync(`DELETE FROM local_transactions WHERE id = ?`, id);
  },

  async markTransactionSynced(id) {
    const db = await initialize();
    const timestamp = nowIso();
    await db.runAsync(
      `UPDATE local_transactions
       SET sync_status = 'synced',
           sync_error = NULL,
           deleted_at = NULL,
           last_synced_at = ?,
           locally_modified_at = ?
       WHERE id = ?`,
      timestamp,
      timestamp,
      id
    );
  },

  async markTransactionSyncError(id, message) {
    const db = await initialize();
    await db.runAsync(
      `UPDATE local_transactions
       SET sync_error = ?
       WHERE id = ?`,
      message ?? 'Sync failed',
      id
    );
  },

  async getPendingTransactions(userId) {
    const db = await initialize();
    return await db.getAllAsync(
      `SELECT *
       FROM local_transactions
       WHERE user_id = ?
         AND sync_status IN ('pending_create', 'pending_update', 'pending_delete')
       ORDER BY datetime(locally_modified_at) ASC`,
      userId
    );
  },

  mapTransactionRow(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      category_id: row.category_id,
      amount: row.amount,
      type: row.type,
      title: row.title,
      description: row.description,
      date: row.date,
      created_at: row.created_at,
      sync_status: row.sync_status,
      sync_error: row.sync_error,
      categories: row.category_id
        ? {
            id: row.category_id,
            name: row.category_name,
            color: row.category_color,
            icon: row.category_icon,
          }
        : null,
    };
  },

  mapBudgetRow(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      category_id: row.category_id,
      total_amount: row.total_amount,
      period: row.period,
      created_at: row.created_at,
      sync_status: row.sync_status,
      sync_error: row.sync_error,
      categories: row.category_id
        ? {
            id: row.category_id,
            name: row.category_name,
            color: row.category_color,
            icon: row.category_icon,
            type: row.category_type,
          }
        : null,
    };
  },

  mapSavingsGoalRow(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      target_amount: row.target_amount,
      saved_amount: row.saved_amount,
      icon: row.icon,
      color: row.color,
      start_date: row.start_date,
      target_date: row.target_date,
      repeat_basis: row.repeat_basis,
      repeat_value: row.repeat_value,
      created_at: row.created_at,
      sync_status: row.sync_status,
      sync_error: row.sync_error,
    };
  },
};

export default localDatabase;
