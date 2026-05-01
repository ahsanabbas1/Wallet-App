import { supabase } from '../lib/supabase';
import { transactionService } from './transactionService';

function createId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function enrichLoan(loan, payments) {
  const loanPayments = (payments || [])
    .filter(p => p.loan_id === loan.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const paidAmount = loanPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const total = parseFloat(loan.total_amount || 0);
  const remaining = Math.max(total - paidAmount, 0);
  const pct = total > 0 ? Math.min((paidAmount / total) * 100, 100) : 0;

  return { ...loan, loan_payments: loanPayments, paid_amount: paidAmount, remaining, pct };
}

export const loanService = {
  async getLoans(userId) {
    const [resLoans, resPayments] = await Promise.all([
      supabase.from('loans').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('loan_payments').select('*, loans!inner(user_id)').eq('loans.user_id', userId),
    ]);
    if (resLoans.error) throw resLoans.error;
    const loans = resLoans.data || [];
    const payments = resPayments.data || [];
    return loans.map(loan => enrichLoan(loan, payments));
  },

  async saveLoan(loanData, isNew = true) {
    const payload = {
      ...loanData,
      id: loanData.id || createId(),
      total_amount: Number(loanData.total_amount),
      created_at: loanData.created_at || new Date().toISOString(),
    };

    if (isNew) {
      const { error } = await supabase.from('loans').insert({
        id: payload.id,
        user_id: payload.user_id,
        type: payload.type,
        person_name: payload.person_name,
        total_amount: payload.total_amount,
        date: payload.date,
        notes: payload.notes ?? null,
        is_settled: payload.is_settled ?? false,
        created_at: payload.created_at,
      });
      if (error) throw error;

      const isGiven = payload.type === 'given';
      await transactionService.addTransaction({
        user_id: payload.user_id,
        amount: payload.total_amount,
        type: isGiven ? 'expense' : 'income',
        title: isGiven ? `Loan to ${payload.person_name}` : `Loan from ${payload.person_name}`,
        description: payload.notes || 'Loan',
        date: payload.date,
      });
    } else {
      const { error } = await supabase
        .from('loans')
        .update({
          type: payload.type,
          person_name: payload.person_name,
          total_amount: payload.total_amount,
          date: payload.date,
          notes: payload.notes ?? null,
        })
        .eq('id', payload.id);
      if (error) throw error;
    }
    return { queued: false, id: payload.id };
  },

  async deleteLoan(userId, id) {
    const { error } = await supabase.from('loans').delete().eq('id', id);
    if (error) throw error;
    return { queued: false };
  },

  async markSettled(userId, id, isSettled) {
    const { error } = await supabase.from('loans').update({ is_settled: isSettled }).eq('id', id);
    if (error) throw error;
  },

  async savePayment(paymentData, loan) {
    const payload = {
      ...paymentData,
      id: paymentData.id || createId(),
      loan_id: loan.id,
      amount: Number(paymentData.amount),
      created_at: paymentData.created_at || new Date().toISOString(),
    };

    const newPaid = (loan.paid_amount || 0) + payload.amount;
    const isSettling = newPaid >= parseFloat(loan.total_amount || 0);

    const { error } = await supabase.from('loan_payments').insert({
      id: payload.id,
      loan_id: payload.loan_id,
      amount: payload.amount,
      date: payload.date,
      notes: payload.notes ?? null,
      created_at: payload.created_at,
    });
    if (error) throw error;

    if (isSettling) {
      await supabase.from('loans').update({ is_settled: true }).eq('id', loan.id);
    }

    const isGiven = loan.type === 'given';
    await transactionService.addTransaction({
      user_id: loan.user_id,
      amount: payload.amount,
      type: isGiven ? 'income' : 'expense',
      title: isGiven ? `Loan repaid by ${loan.person_name}` : `Loan repaid to ${loan.person_name}`,
      description: payload.notes || 'Loan repayment',
      date: payload.date,
    });

    return { queued: false, id: payload.id, isSettling };
  },

  async deletePayment(id) {
    const { error } = await supabase.from('loan_payments').delete().eq('id', id);
    if (error) throw error;
    return { queued: false };
  },
};

export default loanService;
