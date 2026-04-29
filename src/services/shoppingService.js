import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import localDatabase from './localDatabase';

const WARRANTY_KEY = 'web_local_warranties';

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

// ─── Background sync helpers ──────────────────────────────────────────────────

async function pullShoppingData(userId) {
  const [resLists, resItems, resWarranties] = await Promise.all([
    supabase.from('shopping_lists').select('*').eq('user_id', userId),
    supabase.from('shopping_items').select('*, shopping_lists!inner(user_id)').eq('shopping_lists.user_id', userId),
    supabase.from('warranties').select('*').eq('user_id', userId),
  ]);

  if (!resLists.error)      await localDatabase.upsertRemoteShoppingLists(resLists.data || []);
  if (!resItems.error)      await localDatabase.upsertRemoteShoppingItems(resItems.data || []);
  if (!resWarranties.error) await localDatabase.upsertRemoteWarranties(resWarranties.data || []);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const shoppingService = {

  // ── Lists ──────────────────────────────────────────────────────────────────

  async getLists(userId) {
    await localDatabase.initialize();

    // Read local immediately
    const localLists = await localDatabase.getShoppingLists(userId);

    // Attach items from local store to each list
    const listsWithItems = await Promise.all(
      localLists.map(async (list) => {
        const items = await localDatabase.getShoppingItems(list.id);
        return { ...list, shopping_items: items };
      })
    );

    // Background sync — does not block
    pullShoppingData(userId).catch(() => {});

    return listsWithItems;
  },

  async saveList(userId, listData) {
    await localDatabase.initialize();

    const payload = {
      ...listData,
      id: listData.id || createLocalId(),
      user_id: userId,
      created_at: listData.created_at || new Date().toISOString(),
    };
    const isNew = !listData.id;

    try {
      if (isNew) {
        const { error } = await supabase.from('shopping_lists').insert({
          id: payload.id,
          user_id: payload.user_id,
          title: payload.title,
          created_at: payload.created_at,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shopping_lists')
          .update({ title: payload.title })
          .eq('id', payload.id);
        if (error) throw error;
      }
      await localDatabase.saveShoppingList(payload, 'synced');
      return { queued: false, id: payload.id };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.saveShoppingList(payload, isNew ? 'pending_create' : 'pending_update');
      return { queued: true, id: payload.id };
    }
  },

  async deleteList(userId, id) {
    await localDatabase.initialize();

    try {
      const { error } = await supabase.from('shopping_lists').delete().eq('id', id);
      if (error) throw error;
      await localDatabase.removeShoppingList(id);
      return { queued: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.deleteShoppingList(id, userId);
      return { queued: true };
    }
  },

  async archiveList(userId, id, isArchived) {
    await localDatabase.initialize();

    // Update local immediately
    const localLists = await localDatabase.getShoppingLists(userId);
    const list = localLists.find(l => l.id === id);
    if (list) {
      await localDatabase.saveShoppingList({ ...list, is_archived: isArchived }, 'pending_update');
    }

    // Try to sync
    try {
      const { error } = await supabase
        .from('shopping_lists')
        .update({ is_archived: isArchived })
        .eq('id', id);
      if (error) throw error;
      if (list) await localDatabase.saveShoppingList({ ...list, is_archived: isArchived }, 'synced');
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      // Already saved as pending_update above
    }
  },

  // ── Items ──────────────────────────────────────────────────────────────────

  async saveItem(listId, itemData) {
    await localDatabase.initialize();

    const payload = {
      ...itemData,
      id: itemData.id || createLocalId(),
      list_id: listId,
      created_at: itemData.created_at || new Date().toISOString(),
      is_completed: itemData.is_completed ?? false,
    };
    const isNew = !itemData.id;

    try {
      if (isNew) {
        const { error } = await supabase.from('shopping_items').insert({
          id: payload.id,
          list_id: payload.list_id,
          name: payload.name,
          description: payload.description ?? null,
          quantity: payload.quantity ?? 1,
          price: payload.price ?? null,
          created_at: payload.created_at,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shopping_items')
          .update({
            name: payload.name,
            description: payload.description ?? null,
            quantity: payload.quantity ?? 1,
            price: payload.price ?? null,
          })
          .eq('id', payload.id);
        if (error) throw error;
      }
      await localDatabase.saveShoppingItem(payload, 'synced');
      return { queued: false, id: payload.id };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.saveShoppingItem(payload, isNew ? 'pending_create' : 'pending_update');
      return { queued: true, id: payload.id };
    }
  },

  async deleteItem(id) {
    await localDatabase.initialize();

    try {
      const { error } = await supabase.from('shopping_items').delete().eq('id', id);
      if (error) throw error;
      await localDatabase.removeShoppingItem(id);
      return { queued: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.deleteShoppingItem(id);
      return { queued: true };
    }
  },

  async toggleItem(listId, itemId, currentStatus) {
    await localDatabase.initialize();

    const newStatus = !currentStatus;

    // Update local immediately
    const items = await localDatabase.getShoppingItems(listId);
    const item = items.find(i => i.id === itemId);
    if (item) {
      await localDatabase.saveShoppingItem({ ...item, is_completed: newStatus }, 'pending_update');
    }

    // Check if all items done → archive list
    const allItems = await localDatabase.getShoppingItems(listId);
    const allDone = allItems.length > 0 && allItems.every(i =>
      i.id === itemId ? newStatus : i.is_completed
    );

    // Try to sync to Supabase
    try {
      const { error } = await supabase
        .from('shopping_items')
        .update({ is_completed: newStatus })
        .eq('id', itemId);
      if (error) throw error;
      if (item) await localDatabase.saveShoppingItem({ ...item, is_completed: newStatus }, 'synced');

      if (allDone) {
        await supabase.from('shopping_lists').update({ is_archived: true }).eq('id', listId);
        // Update local list archive status
        const lists = await localDatabase.getShoppingLists(item?.user_id || '');
        const list = lists.find(l => l.id === listId);
        if (list) await localDatabase.saveShoppingList({ ...list, is_archived: true }, 'synced');
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      // Items already pending_update, archive list locally if needed
      if (allDone) await this.archiveList(item?.user_id || '', listId, true);
    }

    return { allDone };
  },

  // ── Warranties ─────────────────────────────────────────────────────────────

  async getWarranties(userId) {
    await localDatabase.initialize();
    const warranties = await localDatabase.getWarranties(userId);
    // Background sync already triggered by getLists; no need to duplicate
    return warranties;
  },

  async saveWarranty(userId, warrantyData) {
    await localDatabase.initialize();

    const payload = {
      ...warrantyData,
      id: warrantyData.id || createLocalId(),
      user_id: userId,
      created_at: warrantyData.created_at || new Date().toISOString(),
    };
    const isNew = !warrantyData.id;

    try {
      if (isNew) {
        const { error } = await supabase.from('warranties').insert({
          id: payload.id,
          user_id: payload.user_id,
          name: payload.name,
          purchase_date: payload.purchase_date ?? null,
          expiry_date: payload.expiry_date ?? null,
          color: payload.color ?? null,
          created_at: payload.created_at,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('warranties')
          .update({
            name: payload.name,
            purchase_date: payload.purchase_date ?? null,
            expiry_date: payload.expiry_date ?? null,
            color: payload.color ?? null,
          })
          .eq('id', payload.id);
        if (error) throw error;
      }
      await localDatabase.saveWarranty(payload, 'synced');
      return { queued: false, id: payload.id };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.saveWarranty(payload, isNew ? 'pending_create' : 'pending_update');
      return { queued: true, id: payload.id };
    }
  },

  async deleteWarranty(userId, id) {
    await localDatabase.initialize();

    try {
      const { error } = await supabase.from('warranties').delete().eq('id', id);
      if (error) throw error;
      await localDatabase.removeWarranty(id);
      return { queued: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.deleteWarranty(id, userId);
      return { queued: true };
    }
  },

  async updateWarrantyNotified(id) {
    await localDatabase.initialize();

    // Update local immediately
    const allWarranties = await localDatabase.getWarranties('');
    // We don't have userId here, so read all and find by id
    const { KEYS: _k, ...db } = localDatabase;
    // Directly patch via save — read all warranties
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    try {
      const raw = await AsyncStorage.getItem('web_local_warranties');
      const rows = raw ? JSON.parse(raw) : [];
      const updated = rows.map(r => r.id === id ? { ...r, is_notified: true } : r);
      await AsyncStorage.setItem('web_local_warranties', JSON.stringify(updated));
    } catch {}

    // Background sync
    supabase.from('warranties').update({ is_notified: true }).eq('id', id).then().catch(() => {});
  },
};

export default shoppingService;
