import { supabase } from '../lib/supabase';
import localDatabase from './localDatabase';
import { transactionService } from './transactionService';

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

// ─── Enrich a loan row with computed payment figures ─────────────────────────

function enrichLoan(loan, payments) {
  const loanPayments = (payments || [])
    .filter(p => p.loan_id === loan.id && !p.deleted_at)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const paidAmount = loanPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const total      = parseFloat(loan.total_amount || 0);
  const remaining  = Math.max(total - paidAmount, 0);
  const pct        = total > 0 ? Math.min((paidAmount / total) * 100, 100) : 0;

  return { ...loan, loan_payments: loanPayments, paid_amount: paidAmount, remaining, pct };
}

// ─── Background pull ──────────────────────────────────────────────────────────

async function pullLoansData(userId) {
  const [resLoans, resPayments] = await Promise.all([
    supabase.from('loans').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('loan_payments')
      .select('*, loans!inner(user_id)')
      .eq('loans.user_id', userId),
  ]);

  if (!resLoans.error)    await localDatabase.upsertRemoteLoans(resLoans.data || []);
  if (!resPayments.error) await localDatabase.upsertRemoteLoanPayments(resPayments.data || []);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const loanService = {

  // ── Read ───────────────────────────────────────────────────────────────────

  async getLoans(userId) {
    await localDatabase.initialize();

    const loans    = await localDatabase.getLoans(userId);
    const payments = await localDatabase.getAllLoanPayments(userId);
    const enriched = loans.map(loan => enrichLoan(loan, payments));

    // Background sync — does not block
    pullLoansData(userId).catch(() => {});

    return enriched;
  },

  // ── Save loan ──────────────────────────────────────────────────────────────

  async saveLoan(loanData, isNew = true) {
    await localDatabase.initialize();

    const payload = {
      ...loanData,
      id:           loanData.id || createLocalId(),
      total_amount: Number(loanData.total_amount),
      created_at:   loanData.created_at || new Date().toISOString(),
    };

    // Write to local first
    await localDatabase.saveLoan(payload, 'pending_create');

    try {
      if (isNew) {
        const { error } = await supabase.from('loans').insert({
          id:           payload.id,
          user_id:      payload.user_id,
          type:         payload.type,
          person_name:  payload.person_name,
          total_amount: payload.total_amount,
          date:         payload.date,
          notes:        payload.notes ?? null,
          is_settled:   payload.is_settled ?? false,
          created_at:   payload.created_at,
        });
        if (error) throw error;

        // Auto-create ledger transaction via transactionService (local-first)
        const isGiven = payload.type === 'given';
        await transactionService.addTransaction({
          user_id:     payload.user_id,
          amount:      payload.total_amount,
          type:        isGiven ? 'expense' : 'income',
          title:       isGiven
            ? `Loan to ${payload.person_name}`
            : `Loan from ${payload.person_name}`,
          description: payload.notes || 'Loan',
          date:        payload.date,
        });

        await localDatabase.saveLoan(payload, 'synced');
        return { queued: false, id: payload.id };
      } else {
        const { error } = await supabase.from('loans')
          .update({
            type:         payload.type,
            person_name:  payload.person_name,
            total_amount: payload.total_amount,
            date:         payload.date,
            notes:        payload.notes ?? null,
          })
          .eq('id', payload.id);
        if (error) throw error;

        await localDatabase.saveLoan(payload, 'synced');
        return { queued: false, id: payload.id };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;

      await localDatabase.saveLoan(payload, isNew ? 'pending_create' : 'pending_update');
      return { queued: true, id: payload.id };
    }
  },

  // ── Delete loan ────────────────────────────────────────────────────────────

  async deleteLoan(userId, id) {
    await localDatabase.initialize();

    try {
      const { error } = await supabase.from('loans').delete().eq('id', id);
      if (error) throw error;
      await localDatabase.removeLoan(id);
      return { queued: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.deleteLoan(id, userId);
      return { queued: true };
    }
  },

  // ── Mark settled ───────────────────────────────────────────────────────────

  async markSettled(userId, id, isSettled) {
    await localDatabase.initialize();

    // Update local immediately
    const loans = await localDatabase.getLoans(userId);
    const loan  = loans.find(l => l.id === id);
    if (loan) {
      await localDatabase.saveLoan({ ...loan, is_settled: isSettled }, 'pending_update');
    }

    try {
      const { error } = await supabase.from('loans').update({ is_settled: isSettled }).eq('id', id);
      if (error) throw error;
      if (loan) await localDatabase.saveLoan({ ...loan, is_settled: isSettled }, 'synced');
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      // Already saved as pending_update above
    }
  },

  // ── Save payment ───────────────────────────────────────────────────────────

  async savePayment(paymentData, loan) {
    await localDatabase.initialize();

    const payload = {
      ...paymentData,
      id:      paymentData.id || createLocalId(),
      loan_id: loan.id,
      amount:  Number(paymentData.amount),
      created_at: paymentData.created_at || new Date().toISOString(),
    };

    const newPaid    = (loan.paid_amount || 0) + payload.amount;
    const isSettling = newPaid >= parseFloat(loan.total_amount || 0);

    // Write to local first
    await localDatabase.saveLoanPayment(payload, 'pending_create');

    try {
      const { error } = await supabase.from('loan_payments').insert({
        id:      payload.id,
        loan_id: payload.loan_id,
        amount:  payload.amount,
        date:    payload.date,
        notes:   payload.notes ?? null,
        created_at: payload.created_at,
      });
      if (error) throw error;

      await localDatabase.saveLoanPayment(payload, 'synced');

      // Auto-settle if fully paid
      if (isSettling) {
        await supabase.from('loans').update({ is_settled: true }).eq('id', loan.id);
        const localLoan = (await localDatabase.getLoans(loan.user_id)).find(l => l.id === loan.id);
        if (localLoan) await localDatabase.saveLoan({ ...localLoan, is_settled: true }, 'synced');
      }

      // Auto-create ledger entry via transactionService (local-first)
      const isGiven = loan.type === 'given';
      await transactionService.addTransaction({
        user_id:     loan.user_id,
        amount:      payload.amount,
        type:        isGiven ? 'income' : 'expense',
        title:       isGiven
          ? `Loan repaid by ${loan.person_name}`
          : `Loan repaid to ${loan.person_name}`,
        description: payload.notes || 'Loan repayment',
        date:        payload.date,
      });

      return { queued: false, id: payload.id, isSettling };
    } catch (error) {
      if (!isNetworkError(error)) throw error;

      // Settle locally if needed
      if (isSettling) {
        const localLoan = (await localDatabase.getLoans(loan.user_id)).find(l => l.id === loan.id);
        if (localLoan) await localDatabase.saveLoan({ ...localLoan, is_settled: true }, 'pending_update');
      }

      return { queued: true, id: payload.id, isSettling };
    }
  },

  // ── Delete payment ─────────────────────────────────────────────────────────

  async deletePayment(id) {
    await localDatabase.initialize();

    try {
      const { error } = await supabase.from('loan_payments').delete().eq('id', id);
      if (error) throw error;
      await localDatabase.removeLoanPayment(id);
      return { queued: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await localDatabase.deleteLoanPayment(id);
      return { queued: true };
    }
  },
};

export default loanService;
