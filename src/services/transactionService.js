import { supabase } from '../lib/supabase';

export const transactionService = {
  async getCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async addTransaction(transactionData) {
    const { error } = await supabase
      .from('transactions')
      .insert(transactionData);

    if (error) throw error;
    return true;
  },

  async updateTransaction(id, transactionData) {
    const { error } = await supabase
      .from('transactions')
      .update(transactionData)
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};
