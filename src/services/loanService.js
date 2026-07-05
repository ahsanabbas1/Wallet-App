import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb, generateId } from '../lib/db';
import { transactionService } from './transactionService';

const LOAN_DEFAULT_ACCOUNT_KEY = (uid) => `loan_default_account_${uid}`;

function enrichLoan(loan, payments) {
  const loanPayments = (payments || [])
    .filter(p => p.loan_id === loan.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const paidPayments = loanPayments.filter(p => p.is_paid);
  const unpaidInstallments = loanPayments
    .filter(p => !p.is_paid && p.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const paidAmount = paidPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const total = parseFloat(loan.total_amount || 0);
  const remaining = Math.max(total - paidAmount, 0);
  const pct = total > 0 ? Math.min((paidAmount / total) * 100, 100) : 0;

  const nextDuePayment = unpaidInstallments.length > 0 ? unpaidInstallments[0] : null;
  const isOverdue = nextDuePayment && new Date(nextDuePayment.due_date) < new Date();
  const remainingInstallments = unpaidInstallments.length;
  const paidInstallments = paidPayments.length;
  const totalInstallments = loanPayments.length;

  // Projected remaining based on effective payment amount
  const lastPaidAmount = paidPayments.length > 0 ? parseFloat(paidPayments[0].amount || 0) : 0;
  const effectiveAmount = parseFloat(loan.installment_amount || 0) || lastPaidAmount || (totalInstallments > 0 ? total / totalInstallments : 0);
  const projectedRemaining = effectiveAmount > 0 && remaining > 0 ? Math.ceil(remaining / effectiveAmount) : remainingInstallments;

  // Projected completion date
  let projectedCompletion = null;
  if (projectedRemaining > 0 && loan.installment_interval) {
    const baseDate = nextDuePayment?.due_date ? new Date(nextDuePayment.due_date) : new Date();
    const endDate = new Date(baseDate);
    switch (loan.installment_interval) {
      case 'weekly': endDate.setDate(endDate.getDate() + 7 * projectedRemaining); break;
      case 'biweekly': endDate.setDate(endDate.getDate() + 14 * projectedRemaining); break;
      case 'monthly': endDate.setMonth(endDate.getMonth() + projectedRemaining); break;
      case 'quarterly': endDate.setMonth(endDate.getMonth() + 3 * projectedRemaining); break;
      case 'yearly': endDate.setFullYear(endDate.getFullYear() + projectedRemaining); break;
    }
    projectedCompletion = endDate.toISOString();
  }

  return {
    ...loan,
    is_settled: loan.is_settled === 1 || loan.is_settled === true,
    is_multi_installment: loan.is_multi_installment === 1 || loan.is_multi_installment === true,
    loan_payments: loanPayments,
    paid_amount: paidAmount,
    remaining,
    pct,
    nextDuePayment,
    isOverdue,
    remaining_installments: remainingInstallments,
    paid_installments: paidInstallments,
    total_installments: totalInstallments,
    next_due_date: nextDuePayment ? nextDuePayment.due_date : null,
    projected_remaining_installments: projectedRemaining,
    projected_completion_date: projectedCompletion,
  };
}

export const loanService = {
  async getLoans(userId) {
    const db = getDb();
    const loans = await db.getAllAsync(
      'SELECT * FROM loans WHERE user_id = ? ORDER BY date DESC',
      [userId]
    );
    const loanIds = loans.map(l => l.id);
    let payments = [];
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
        `INSERT INTO loans (
          id, user_id, account_id, type, person_name, total_amount, date, due_date,
          notes, is_settled, is_multi_installment, repayment_type, num_installments,
          installment_interval, define_by, installment_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, loanData.user_id, loanData.account_id || null, loanData.type, loanData.person_name,
          Number(loanData.total_amount), loanData.date, loanData.due_date || null,
          loanData.notes ?? null, loanData.is_settled ? 1 : 0,
          loanData.is_multi_installment ? 1 : 0,
          loanData.repayment_type || 'single',
          loanData.is_multi_installment ? (loanData.num_installments || null) : null,
          loanData.installment_interval || null,
          loanData.define_by || 'count',
          loanData.installment_amount || null,
          loanData.created_at || new Date().toISOString(),
        ]
      );

      const isGiven = loanData.type === 'given';
      await transactionService.addTransaction({
        user_id: loanData.user_id,
        amount: loanData.total_amount,
        type: isGiven ? 'expense' : 'income',
        title: isGiven ? `Loan to ${loanData.person_name}` : `Loan from ${loanData.person_name}`,
        description: loanData.notes || 'Loan',
        date: loanData.date,
        account_id: loanData.account_id || null,
        is_loan: 1,
      });

      // Create installment payments if multi-installment
      if (loanData.is_multi_installment && loanData.num_installments > 0) {
        await this.createInstallmentPayments(id, loanData);
      }
    } else {
      await db.runAsync(
        `UPDATE loans
         SET type = ?, person_name = ?, total_amount = ?, date = ?, due_date = ?,
             notes = ?, account_id = ?, is_multi_installment = ?, num_installments = ?,
             installment_interval = ?, define_by = ?, installment_amount = ?
         WHERE id = ?`,
        [
          loanData.type, loanData.person_name, Number(loanData.total_amount),
          loanData.date, loanData.due_date || null, loanData.notes ?? null,
          loanData.account_id || null, loanData.is_multi_installment ? 1 : 0,
          loanData.num_installments || null, loanData.installment_interval || null,
          loanData.define_by || 'count', loanData.installment_amount || null,
          loanData.id
        ]
      );

      // Regenerate unpaid installments when loan structure changes
      if (loanData.is_multi_installment) {
        await db.runAsync('DELETE FROM loan_payments WHERE loan_id = ? AND is_paid = 0', [loanData.id]);
        const paidResult = await db.getAllAsync(
          'SELECT COALESCE(SUM(amount), 0) as paid FROM loan_payments WHERE loan_id = ? AND is_paid = 1',
          [loanData.id]
        );
        const paidSoFar = paidResult[0]?.paid || 0;
        const remainingAmount = Math.max(Number(loanData.total_amount) - paidSoFar, 0);
        if (remainingAmount > 0) {
          await this.createInstallmentPayments(loanData.id, { ...loanData, total_amount: remainingAmount });
        }
      }
    }
    return { id };
  },

  async createInstallmentPayments(loanId, loanData) {
    const db = getDb();
    const defineBy = loanData.define_by || 'count';
    const total = parseFloat(loanData.total_amount);
    let numInstallments, installmentAmount;

    if (defineBy === 'amount') {
      installmentAmount = parseFloat(loanData.installment_amount);
      numInstallments = Math.ceil(total / installmentAmount);
    } else {
      numInstallments = loanData.num_installments;
      installmentAmount = total / numInstallments;
    }

    const interval = loanData.installment_interval || 'monthly';
    let startDate = new Date(loanData.due_date || loanData.date);

    for (let i = 0; i < numInstallments; i++) {
      const dueDate = this.calculateDueDate(startDate, interval, i + 1);
      const paymentId = generateId();
      const amt = (defineBy === 'amount' && i === numInstallments - 1)
        ? total - (installmentAmount * (numInstallments - 1))
        : installmentAmount;

      await db.runAsync(
        `INSERT INTO loan_payments (id, loan_id, amount, due_date, is_paid, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [paymentId, loanId, amt, dueDate.toISOString(), new Date().toISOString()]
      );
    }
  },

  calculateDueDate(baseDate, interval, occurrence) {
    const date = new Date(baseDate);
    switch (interval) {
      case 'weekly':
        date.setDate(date.getDate() + 7 * occurrence);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14 * occurrence);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + occurrence);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3 * occurrence);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + occurrence);
        break;
      default:
        date.setMonth(date.getMonth() + occurrence);
    }
    return date;
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

  async settleLoan(userId, loan, accountId) {
    const db = getDb();
    const remaining = loan.remaining;
    const now = new Date().toISOString();
    const paymentId = generateId();

    const paidRows = await db.getAllAsync(
      'SELECT COALESCE(SUM(amount), 0) as paid FROM loan_payments WHERE loan_id = ? AND is_paid = 1',
      [loan.id]
    );
    const paidSoFar = paidRows[0]?.paid || 0;
    if (paidSoFar >= parseFloat(loan.total_amount || 0)) {
      await db.runAsync('UPDATE loans SET is_settled = 1 WHERE id = ?', [loan.id]);
      return {};
    }

    await db.runAsync(
      `INSERT INTO loan_payments (id, loan_id, amount, date, is_paid, notes, created_at)
       VALUES (?, ?, ?, ?, 1, 'Settlement', ?)`,
      [paymentId, loan.id, remaining, now, now]
    );

    const isGiven = loan.type === 'given';
    const { id: txnId } = await transactionService.addTransaction({
      user_id: userId,
      amount: remaining,
      type: isGiven ? 'expense' : 'income',
      title: isGiven ? `Loan settlement - ${loan.person_name}` : `Loan settlement - ${loan.person_name}`,
      description: 'Settlement of remaining balance',
      date: now,
      account_id: accountId || loan.account_id || null,
      is_loan: 1,
    });

    if (txnId) {
      await db.runAsync('UPDATE loan_payments SET transaction_id = ? WHERE id = ?', [txnId, paymentId]);
    }

    await db.runAsync('UPDATE loans SET is_settled = 1 WHERE id = ?', [loan.id]);
    return {};
  },

  async savePayment(paymentData, loan, accountId) {
    const db = getDb();
    const amt = Number(paymentData.amount);
    let id;

    if (loan.is_multi_installment) {
      const unpaid = await db.getAllAsync(
        'SELECT id, amount FROM loan_payments WHERE loan_id = ? AND is_paid = 0 ORDER BY due_date ASC LIMIT 1',
        [loan.id]
      );
      if (unpaid.length > 0) {
        id = unpaid[0].id;
        await db.runAsync(
          'UPDATE loan_payments SET is_paid = 1, amount = ?, date = ?, notes = ? WHERE id = ?',
          [amt, paymentData.date, paymentData.notes ?? null, id]
        );
      } else {
        id = paymentData.id || generateId();
        await db.runAsync(
          `INSERT INTO loan_payments (id, loan_id, amount, date, due_date, notes, is_paid, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
          [id, loan.id, amt, paymentData.date, paymentData.due_date || paymentData.date,
            paymentData.notes ?? null, paymentData.created_at || new Date().toISOString()]
        );
      }
    } else {
      id = paymentData.id || generateId();
      await db.runAsync(
        `INSERT INTO loan_payments (id, loan_id, amount, date, due_date, notes, is_paid, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [id, loan.id, amt, paymentData.date, paymentData.due_date || paymentData.date,
          paymentData.notes ?? null, paymentData.created_at || new Date().toISOString()]
      );
    }

    const newPaid = (loan.paid_amount || 0) + amt;
    const isSettling = newPaid >= parseFloat(loan.total_amount || 0);

    if (isSettling) {
      await db.runAsync('UPDATE loans SET is_settled = 1 WHERE id = ?', [loan.id]);
    }

    const isGiven = loan.type === 'given';
    const { id: txnId } = await transactionService.addTransaction({
      user_id: loan.user_id,
      amount: amt,
      type: isGiven ? 'income' : 'expense',
      title: isGiven ? `Loan repaid by ${loan.person_name}` : `Loan repaid to ${loan.person_name}`,
      description: paymentData.notes || 'Loan repayment',
      date: paymentData.date,
      account_id: accountId || loan.account_id || null,
      is_loan: 1,
    });

    // Save the transaction_id on the payment record for reverse-sync
    if (id && txnId) {
      await db.runAsync('UPDATE loan_payments SET transaction_id = ? WHERE id = ?', [txnId, id]);
    }

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

  async deletePayment(id, loan) {
    const db = getDb();
    // Find the transaction_id linked to this payment
    const pay = await db.getFirstAsync('SELECT transaction_id, amount FROM loan_payments WHERE id = ?', [id]);
    const txnId = pay?.transaction_id;

    if (loan?.is_multi_installment) {
      // Keep the row to preserve installment schedule, just mark unpaid
      await db.runAsync(
        'UPDATE loan_payments SET is_paid = 0, notes = NULL, transaction_id = NULL WHERE id = ?',
        [id]
      );
    } else {
      // Single-payment: remove the row entirely
      await db.runAsync('DELETE FROM loan_payments WHERE id = ?', [id]);
    }

    // If the loan was settled because of this payment, un-settle it
    if (loan?.is_settled) {
      const paidRows = await db.getAllAsync(
        'SELECT COALESCE(SUM(amount), 0) as paid FROM loan_payments WHERE loan_id = ? AND is_paid = 1',
        [loan.id]
      );
      const totalPaid = paidRows[0]?.paid || 0;
      if (totalPaid < parseFloat(loan.total_amount || 0)) {
        await db.runAsync('UPDATE loans SET is_settled = 0 WHERE id = ?', [loan.id]);
      }
    }

    // Delete the linked transaction (reverses account balance automatically)
    if (txnId) {
      await transactionService.deleteTransaction(loan?.user_id, txnId).catch(() => {});
    }
    return {};
  },

  async getDefaultPaymentAccount(userId) {
    try {
      const raw = await AsyncStorage.getItem(LOAN_DEFAULT_ACCOUNT_KEY(userId));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  async setDefaultPaymentAccount(userId, account) {
    try {
      if (account) {
        await AsyncStorage.setItem(LOAN_DEFAULT_ACCOUNT_KEY(userId), JSON.stringify(account));
      } else {
        await AsyncStorage.removeItem(LOAN_DEFAULT_ACCOUNT_KEY(userId));
      }
    } catch {}
  },
};

export default loanService;
