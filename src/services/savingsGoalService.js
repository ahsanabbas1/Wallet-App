import { getDb, generateId } from '../lib/db';

export const savingsGoalService = {
  async getSavingsGoals(userId) {
    const db   = getDb();
    const data = await db.getAllAsync(
      'SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return { data };
  },

  async saveSavingsGoal(userId, goalData, existingId = null) {
    const db = getDb();
    const id = existingId || goalData.id || generateId();

    if (existingId) {
      await db.runAsync(
        `UPDATE savings_goals
         SET title = ?, target_amount = ?, saved_amount = ?, icon = ?, color = ?,
             start_date = ?, target_date = ?, repeat_basis = ?, repeat_value = ?
         WHERE id = ?`,
        [
          goalData.title,
          Number(goalData.target_amount),
          Number(goalData.saved_amount ?? 0),
          goalData.icon     ?? null,
          goalData.color    ?? null,
          goalData.start_date  ?? null,
          goalData.target_date ?? null,
          goalData.repeat_basis ?? null,
          goalData.repeat_value == null ? null : Number(goalData.repeat_value),
          existingId,
        ]
      );
    } else {
      await db.runAsync(
        `INSERT INTO savings_goals
           (id, user_id, title, target_amount, saved_amount, icon, color,
            start_date, target_date, repeat_basis, repeat_value, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, userId,
          goalData.title,
          Number(goalData.target_amount),
          Number(goalData.saved_amount ?? 0),
          goalData.icon     ?? null,
          goalData.color    ?? null,
          goalData.start_date  ?? null,
          goalData.target_date ?? null,
          goalData.repeat_basis ?? null,
          goalData.repeat_value == null ? null : Number(goalData.repeat_value),
          goalData.created_at || new Date().toISOString(),
        ]
      );
    }
    return { id };
  },

  async updateSavingsGoal(userId, id, updates) {
    const db     = getDb();
    const fields = [];
    const vals   = [];

    const add = (col, val) => { fields.push(`${col} = ?`); vals.push(val); };

    if (updates.title        !== undefined) add('title',        updates.title);
    if (updates.target_amount !== undefined) add('target_amount', Number(updates.target_amount));
    if (updates.saved_amount  !== undefined) add('saved_amount',  Number(updates.saved_amount));
    if (updates.icon          !== undefined) add('icon',          updates.icon ?? null);
    if (updates.color         !== undefined) add('color',         updates.color ?? null);
    if (updates.start_date    !== undefined) add('start_date',    updates.start_date ?? null);
    if (updates.target_date   !== undefined) add('target_date',   updates.target_date ?? null);
    if (updates.repeat_basis  !== undefined) add('repeat_basis',  updates.repeat_basis ?? null);
    if (updates.repeat_value  !== undefined) add('repeat_value',  updates.repeat_value == null ? null : Number(updates.repeat_value));

    if (fields.length === 0) return { id };
    await db.runAsync(
      `UPDATE savings_goals SET ${fields.join(', ')} WHERE id = ?`,
      [...vals, id]
    );
    return { id };
  },

  async deleteSavingsGoal(userId, id) {
    const db = getDb();
    await db.runAsync('DELETE FROM savings_goals WHERE id = ?', [id]);
    return { id };
  },
};

export default savingsGoalService;
