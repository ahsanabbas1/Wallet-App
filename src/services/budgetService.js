import { supabase } from '../lib/supabase';

function createId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const budgetService = {
  async getBudgets(userId) {
    const { data, error } = await supabase
      .from('budgets')
      .select('*, categories(id, name, icon, color, type)')
      .eq('user_id', userId);
    if (error) throw error;
    return { data: data || [] };
  },

  async saveBudget(userId, budgetData, existingId = null) {
    const id = existingId || budgetData.id || createId();
    const payload = {
      id,
      user_id: userId,
      category_id: budgetData.category_id,
      total_amount: Number(budgetData.total_amount),
      period: budgetData.period,
      created_at: budgetData.created_at || new Date().toISOString(),
    };

    if (existingId) {
      const { error } = await supabase
        .from('budgets')
        .update({ category_id: payload.category_id, total_amount: payload.total_amount, period: payload.period })
        .eq('id', existingId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('budgets').insert(payload);
      if (error) throw error;
    }
    return { queued: false, id };
  },

  async deleteBudget(userId, id) {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) throw error;
    return { queued: false, id };
  },
};

export default budgetService;
