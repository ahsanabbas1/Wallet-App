import { getDb, generateId } from '../lib/db';
import { transactionService } from './transactionService';

function enrichLoan(loan, payments) {
  const loanPayments = (payments || [])
    .filter(p => p.loan_id === loan.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const paidAmount = loanPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const total      = parseFloat(loan.total_amount || 0);
  const remaining  = Math.max(total - paidAmount, 0);
  const pct        = total > 0 ? Math.min((paidAmount / total) * 100, 100) : 0;

  return {
    ...loan,
    is_settled:   loan.is_settled === 1 || loan.is_settled === true,
    loan_payments: loanPayments,
    paid_amount:   paidAmount,
    remaining,
    pct,
  };
}

export const loanService = {
  async getLoans(userId) {
    const db       = getDb();
    const loans    = await db.getAllAsync(
      'SELECT * FROM loans WHERE user_id = ? ORDER BY date DESC',
      [userId]
    );
    const loanIds  = loans.map(l => l.id);
    let payments   = [];
    if (loanIds.length > 0) {
      const placeholders = loanIds.map(() => '?').join(', ');
      payments = await db.getAllAsync(
        `SELECT * FROM loan_payments WHERE loan_id IN (${placeholders})`,
        loanIds
      );
    }
    return loans.map(loan => enrichLoan(loan, payments));
  },

  async saveLoan(loanData, isNew = true) {
    const db = getDb();
    const id = loanData.id || generateId();

    if (isNew) {
      await db.runAsync(
        `INSERT INTO loans (id, user_id, type, person_name, total_amount, date, notes, is_settled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, loanData.user_id, loanData.type, loanData.person_name,
          Number(loanData.total_amount), loanData.date,
          loanData.notes ?? null, loanData.is_settled ? 1 : 0,
          loanData.created_at || new Date().toISOString(),
        ]
      );

      const isGiven = loanData.type === 'given';
      await transactionService.addTransaction({
        user_id:     loanData.user_id,
        amount:      loanData.total_amount,
        type:        isGiven ? 'expense' : 'income',
        title:       isGiven ? `Loan to ${loanData.person_name}` : `Loan from ${loanData.person_name}`,
        description: loanData.notes || 'Loan',
        date:        loanData.date,
        is_loan:     1,
      });
    } else {
      await db.runAsync(
        `UPDATE loans
         SET type = ?, person_name = ?, total_amount = ?, date = ?, notes = ?
         WHERE id = ?`,
        [loanData.type, loanData.person_name, Number(loanData.total_amount),
         loanData.date, loanData.notes ?? null, loanData.id]
      );
    }
    return { id };
  },

  async deleteLoan(userId, id) {
    const db = getDb();
    await db.runAsync('DELETE FROM loan_payments WHERE loan_id = ?', [id]);
    await db.runAsync('DELETE FROM loans WHERE id = ?', [id]);
    return {};
  },

  async markSettled(userId, id, isSettled) {
    const db = getDb();
    await db.runAsync('UPDATE loans SET is_settled = ? WHERE id = ?', [isSettled ? 1 : 0, id]);
  },

  async savePayment(paymentData, loan) {
    const db  = getDb();
    const id  = paymentData.id || generateId();
    const amt = Number(paymentData.amount);

    await db.runAsync(
      `INSERT INTO loan_payments (id, loan_id, amount, date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, loan.id, amt, paymentData.date, paymentData.notes ?? null,
       paymentData.created_at || new Date().toISOString()]
    );

    const newPaid    = (loan.paid_amount || 0) + amt;
    const isSettling = newPaid >= parseFloat(loan.total_amount || 0);

    if (isSettling) {
      await db.runAsync('UPDATE loans SET is_settled = 1 WHERE id = ?', [loan.id]);
    }

    const isGiven = loan.type === 'given';
    await transactionService.addTransaction({
      user_id:     loan.user_id,
      amount:      amt,
      type:        isGiven ? 'income' : 'expense',
      title:       isGiven ? `Loan repaid by ${loan.person_name}` : `Loan repaid to ${loan.person_name}`,
      description: paymentData.notes || 'Loan repayment',
      date:        paymentData.date,
      is_loan:     1,
    });

    return { id, isSettling };
  },

  async updatePayment(id, fields) {
    const db = getDb();
    await db.runAsync(
      'UPDATE loan_payments SET amount = ?, date = ?, notes = ? WHERE id = ?',
      [Number(fields.amount), fields.date, fields.notes ?? null, id]
    );
    return {};
  },

  async deletePayment(id) {
    const db = getDb();
    await db.runAsync('DELETE FROM loan_payments WHERE id = ?', [id]);
    return {};
  },
};

export default loanService;
