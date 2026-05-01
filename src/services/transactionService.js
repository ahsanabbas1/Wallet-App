import { supabase } from '../lib/supabase';

function createId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function buildDateFilter(query, options = {}) {
  const { period = 'ALL', customStartDate, customEndDate } = options;
  if (period === 'ALL') return query;

  const now = new Date();
  let start = null;

  if (period === 'TODAY') {
    start = new Date(); start.setHours(0, 0, 0, 0);
  } else if (period === '1W') {
    start = new Date(); start.setDate(now.getDate() - 7);
  } else if (period === '1M') {
    start = new Date(); start.setMonth(now.getMonth() - 1);
  } else if (period === '6M') {
    start = new Date(); start.setMonth(now.getMonth() - 6);
  } else if (period === '1Y') {
    start = new Date(); start.setFullYear(now.getFullYear() - 1);
  } else if (period === 'CUSTOM' && customStartDate) {
    start = new Date(customStartDate);
  }

  if (start) query = query.gte('date', start.toISOString());

  if (period === 'CUSTOM' && customEndDate) {
    const end = new Date(customEndDate);
    end.setHours(23, 59, 59, 999);
    query = query.lte('date', end.toISOString());
  }

  return query;
}

export const transactionService = {
  async initialize() {},

  async getCategories(userId) {
    const { data, error } = await supabase
      .from('categories')
      .select('id, user_id, parent_id, name, icon, color, type, created_at')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getTransactions(userId, options = {}) {
    let query = supabase
      .from('transactions')
      .select('*, categories(id, name, icon, color, type, parent_id)')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    query = buildDateFilter(query, options);

    const { data, error } = await query;
    if (error) throw error;
    return { data: data || [] };
  },

  async addTransaction(transactionData) {
    const payload = {
      ...transactionData,
      id: transactionData.id || createId(),
      amount: Number(transactionData.amount),
      created_at: transactionData.created_at || transactionData.date || new Date().toISOString(),
    };
    const { error } = await supabase.from('transactions').insert(payload);
    if (error) throw error;
    return { queued: false, id: payload.id };
  },

  async updateTransaction(id, transactionData) {
    const { error } = await supabase
      .from('transactions')
      .update({
        category_id: transactionData.category_id ?? null,
        amount: Number(transactionData.amount),
        type: transactionData.type,
        title: transactionData.title,
        description: transactionData.description ?? null,
        date: transactionData.date,
      })
      .eq('id', id);
    if (error) throw error;
    return { queued: false, id };
  },

  async deleteTransaction(userId, id) {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
    return { queued: false, id };
  },
};

export default transactionService;
