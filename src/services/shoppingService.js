import { supabase } from '../lib/supabase';

function createId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const shoppingService = {
  async getLists(userId) {
    const { data: lists, error: listsError } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (listsError) throw listsError;

    if (!lists || lists.length === 0) return [];

    const listIds = lists.map(l => l.id);
    const { data: items } = await supabase
      .from('shopping_items')
      .select('*')
      .in('list_id', listIds);

    return lists.map(list => ({
      ...list,
      shopping_items: (items || []).filter(i => i.list_id === list.id),
    }));
  },

  async saveList(userId, listData) {
    const id = listData.id || createId();
    const isNew = !listData.id;
    const payload = { id, user_id: userId, title: listData.title, created_at: listData.created_at || new Date().toISOString() };

    if (isNew) {
      const { error } = await supabase.from('shopping_lists').insert(payload);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('shopping_lists').update({ title: listData.title }).eq('id', id);
      if (error) throw error;
    }
    return { queued: false, id };
  },

  async deleteList(userId, id) {
    await supabase.from('shopping_items').delete().eq('list_id', id);
    const { error } = await supabase.from('shopping_lists').delete().eq('id', id);
    if (error) throw error;
    return { queued: false };
  },

  async archiveList(userId, id, isArchived) {
    const { error } = await supabase.from('shopping_lists').update({ is_archived: isArchived }).eq('id', id);
    if (error) throw error;
  },

  async saveItem(listId, itemData) {
    const id = itemData.id || createId();
    const isNew = !itemData.id;
    const payload = {
      id,
      list_id: listId,
      name: itemData.name,
      description: itemData.description ?? null,
      quantity: itemData.quantity ?? 1,
      price: itemData.price ?? null,
      is_completed: itemData.is_completed ?? false,
      created_at: itemData.created_at || new Date().toISOString(),
    };

    if (isNew) {
      const { error } = await supabase.from('shopping_items').insert(payload);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('shopping_items')
        .update({ name: payload.name, description: payload.description, quantity: payload.quantity, price: payload.price })
        .eq('id', id);
      if (error) throw error;
    }
    return { queued: false, id };
  },

  async deleteItem(id) {
    const { error } = await supabase.from('shopping_items').delete().eq('id', id);
    if (error) throw error;
    return { queued: false };
  },

  async toggleItem(listId, itemId, currentStatus) {
    const newStatus = !currentStatus;

    const { error } = await supabase.from('shopping_items').update({ is_completed: newStatus }).eq('id', itemId);
    if (error) throw error;

    const { data: allItems } = await supabase.from('shopping_items').select('id, is_completed').eq('list_id', listId);
    const allDone = (allItems || []).length > 0 && (allItems || []).every(i =>
      i.id === itemId ? newStatus : i.is_completed
    );

    if (allDone) {
      await supabase.from('shopping_lists').update({ is_archived: true }).eq('id', listId);
    }

    return { allDone };
  },

  async getWarranties(userId) {
    const { data, error } = await supabase.from('warranties').select('*').eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },

  async saveWarranty(userId, warrantyData) {
    const id = warrantyData.id || createId();
    const isNew = !warrantyData.id;
    const payload = {
      id,
      user_id: userId,
      name: warrantyData.name,
      purchase_date: warrantyData.purchase_date ?? null,
      expiry_date: warrantyData.expiry_date ?? null,
      color: warrantyData.color ?? null,
      created_at: warrantyData.created_at || new Date().toISOString(),
    };

    if (isNew) {
      const { error } = await supabase.from('warranties').insert(payload);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('warranties')
        .update({ name: payload.name, purchase_date: payload.purchase_date, expiry_date: payload.expiry_date, color: payload.color })
        .eq('id', id);
      if (error) throw error;
    }
    return { queued: false, id };
  },

  async deleteWarranty(userId, id) {
    const { error } = await supabase.from('warranties').delete().eq('id', id);
    if (error) throw error;
    return { queued: false };
  },

  async updateWarrantyNotified(id) {
    supabase.from('warranties').update({ is_notified: true }).eq('id', id).catch(() => {});
  },
};

export default shoppingService;
