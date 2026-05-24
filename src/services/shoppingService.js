import { getDb, generateId } from '../lib/db';

export const shoppingService = {
  async getLists(userId) {
    const db    = getDb();
    const lists = await db.getAllAsync(
      'SELECT * FROM shopping_lists WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    if (!lists || lists.length === 0) return [];

    const ids          = lists.map(l => l.id);
    const placeholders = ids.map(() => '?').join(', ');
    const items        = await db.getAllAsync(
      `SELECT * FROM shopping_items WHERE list_id IN (${placeholders})`,
      ids
    );

    return lists.map(list => ({
      ...list,
      is_archived:     list.is_archived === 1,
      shopping_items:  (items || []).filter(i => i.list_id === list.id)
                         .map(i => ({ ...i, is_completed: i.is_completed === 1 })),
    }));
  },

  async saveList(userId, listData) {
    const db    = getDb();
    const id    = listData.id || generateId();
    const isNew = !listData.id;
    const now   = new Date().toISOString();

    if (isNew) {
      await db.runAsync(
        'INSERT INTO shopping_lists (id, user_id, title, is_archived, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
        [id, userId, listData.title, listData.created_at || now, now]
      );
    } else {
      await db.runAsync(
        'UPDATE shopping_lists SET title = ?, updated_at = ? WHERE id = ?',
        [listData.title, now, id]
      );
    }
    return { id };
  },

  async deleteList(userId, id) {
    const db = getDb();
    await db.runAsync('DELETE FROM shopping_items WHERE list_id = ?', [id]);
    await db.runAsync('DELETE FROM shopping_lists WHERE id = ?', [id]);
    return {};
  },

  async archiveList(userId, id, isArchived) {
    const db = getDb();
    await db.runAsync('UPDATE shopping_lists SET is_archived = ? WHERE id = ?', [isArchived ? 1 : 0, id]);
  },

  async saveItem(listId, itemData) {
    const db    = getDb();
    const id    = itemData.id || generateId();
    const isNew = !itemData.id;

    if (isNew) {
      await db.runAsync(
        `INSERT INTO shopping_items (id, list_id, name, description, quantity, price, is_completed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [id, listId, itemData.name, itemData.description ?? null,
         itemData.quantity ?? 1, itemData.price ?? null,
         itemData.created_at || new Date().toISOString()]
      );
    } else {
      await db.runAsync(
        'UPDATE shopping_items SET name = ?, description = ?, quantity = ?, price = ? WHERE id = ?',
        [itemData.name, itemData.description ?? null, itemData.quantity ?? 1, itemData.price ?? null, id]
      );
    }
    return { id };
  },

  async deleteItem(id) {
    const db = getDb();
    await db.runAsync('DELETE FROM shopping_items WHERE id = ?', [id]);
    return {};
  },

  async toggleItem(listId, itemId, currentStatus) {
    const db        = getDb();
    const newStatus = currentStatus ? 0 : 1;

    await db.runAsync('UPDATE shopping_items SET is_completed = ? WHERE id = ?', [newStatus, itemId]);

    const allItems = await db.getAllAsync(
      'SELECT id, is_completed FROM shopping_items WHERE list_id = ?',
      [listId]
    );
    const allDone  = allItems.length > 0 && allItems.every(i =>
      i.id === itemId ? newStatus === 1 : i.is_completed === 1
    );

    if (allDone) {
      await db.runAsync('UPDATE shopping_lists SET is_archived = 1 WHERE id = ?', [listId]);
    }
    return { allDone };
  },

  async getWarranties(userId) {
    const db   = getDb();
    const rows = await db.getAllAsync(
      'SELECT * FROM warranties WHERE user_id = ?',
      [userId]
    );
    return rows.map(w => ({ ...w, is_notified: w.is_notified === 1 }));
  },

  async saveWarranty(userId, warrantyData) {
    const db    = getDb();
    const id    = warrantyData.id || generateId();
    const isNew = !warrantyData.id;

    if (isNew) {
      await db.runAsync(
        `INSERT INTO warranties (id, user_id, name, purchase_date, expiry_date, color, is_notified, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [id, userId, warrantyData.name, warrantyData.purchase_date ?? null,
         warrantyData.expiry_date ?? null, warrantyData.color ?? null,
         warrantyData.created_at || new Date().toISOString()]
      );
    } else {
      await db.runAsync(
        'UPDATE warranties SET name = ?, purchase_date = ?, expiry_date = ?, color = ? WHERE id = ?',
        [warrantyData.name, warrantyData.purchase_date ?? null,
         warrantyData.expiry_date ?? null, warrantyData.color ?? null, id]
      );
    }
    return { id };
  },

  async deleteWarranty(userId, id) {
    const db = getDb();
    await db.runAsync('DELETE FROM warranties WHERE id = ?', [id]);
    return {};
  },

  async updateWarrantyNotified(id) {
    try {
      const db = getDb();
      await db.runAsync('UPDATE warranties SET is_notified = 1 WHERE id = ?', [id]);
    } catch {}
  },
};

export default shoppingService;
