import { supabase } from '../lib/supabase';

function createId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const savingsGoalService = {
  async getSavingsGoals(userId) {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { data: data || [] };
  },

  async saveSavingsGoal(userId, goalData, existingId = null) {
    const id = existingId || goalData.id || createId();
    const payload = {
      id,
      user_id: userId,
      title: goalData.title,
      target_amount: Number(goalData.target_amount),
      saved_amount: Number(goalData.saved_amount ?? 0),
      icon: goalData.icon ?? null,
      color: goalData.color ?? null,
      start_date: goalData.start_date ?? null,
      target_date: goalData.target_date ?? null,
      repeat_basis: goalData.repeat_basis ?? null,
      repeat_value: goalData.repeat_value == null ? null : Number(goalData.repeat_value),
      created_at: goalData.created_at || new Date().toISOString(),
    };

    if (existingId) {
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
        .eq('id', existingId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('savings_goals').insert(payload);
      if (error) throw error;
    }
    return { queued: false, id };
  },

  async updateSavingsGoal(userId, id, updates) {
    const { error } = await supabase
      .from('savings_goals')
      .update({
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.target_amount !== undefined && { target_amount: Number(updates.target_amount) }),
        ...(updates.saved_amount !== undefined && { saved_amount: Number(updates.saved_amount) }),
        ...(updates.icon !== undefined && { icon: updates.icon ?? null }),
        ...(updates.color !== undefined && { color: updates.color ?? null }),
        ...(updates.start_date !== undefined && { start_date: updates.start_date ?? null }),
        ...(updates.target_date !== undefined && { target_date: updates.target_date ?? null }),
        ...(updates.repeat_basis !== undefined && { repeat_basis: updates.repeat_basis ?? null }),
        ...(updates.repeat_value !== undefined && { repeat_value: updates.repeat_value == null ? null : Number(updates.repeat_value) }),
      })
      .eq('id', id);
    if (error) throw error;
    return { queued: false, id };
  },

  async deleteSavingsGoal(userId, id) {
    const { error } = await supabase.from('savings_goals').delete().eq('id', id);
    if (error) throw error;
    return { queued: false, id };
  },
};

export default savingsGoalService;
