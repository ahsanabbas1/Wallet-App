import { supabase } from '../lib/supabase';

export const paymentService = {
  /**
   * Fetch all planned payments for a specific user.
   */
  async getPlannedPayments(userId) {
    const { data, error } = await supabase
      .from('planned_payments')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  },

  /**
   * Add a new planned payment.
   */
  async addPlannedPayment(paymentData) {
    const { error } = await supabase
      .from('planned_payments')
      .insert(paymentData);

    if (error) throw error;
    return true;
  },

  /**
   * Delete a planned payment by ID.
   */
  async deletePlannedPayment(id) {
    const { error } = await supabase
      .from('planned_payments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};
