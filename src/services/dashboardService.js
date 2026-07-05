import { getDb } from '../lib/db';
import { transactionService } from './transactionService';
import savingsGoalService from './savingsGoalService';
import { paymentService } from './paymentService';
import { loanService } from './loanService';
import budgetService, { decodeBudget, getActivePeriod, getRelatedCategoryIds } from './budgetService';
import { accountService } from './accountService';

export const dashboardService = {
  async getUserProfile(userId) {
    if (!userId) return null;
    try {
      const db  = getDb();
      const row = await db.getFirstAsync('SELECT name, currency FROM users WHERE id = ?', [userId]);
      return row || null;
    } catch { return null; }
  },

  async getCashAdjustment(userId) {
    try {
      const db  = getDb();
      const row = await db.getFirstAsync('SELECT cash_adjustment FROM users WHERE id = ?', [userId]);
      return parseFloat(row?.cash_adjustment || 0);
    } catch { return 0; }
  },

  async setCashAdjustment(userId, amount) {
    const db = getDb();
    await db.runAsync('UPDATE users SET cash_adjustment = ? WHERE id = ?', [amount, userId]);
  },

  _getDateRange(period = 'MONTH') {
    const now       = new Date();
    const startDate = new Date(now);
    switch (period) {
      case 'WEEK':  startDate.setDate(now.getDate() - 7);         break;
      case 'MONTH': startDate.setMonth(now.getMonth() - 1);       break;
      case 'YEAR':  startDate.setFullYear(now.getFullYear() - 1); break;
      default:      startDate.setMonth(now.getMonth() - 1);
    }
    return { startDate, endDate: now };
  },

  async getDashboardData(userId) {
    await paymentService.syncDuePlannedPayments(userId).catch(() => {});

    const { data: transactions } = await transactionService.getTransactions(userId, { period: 'ALL' });
    const { data: goalsData }    = await savingsGoalService.getSavingsGoals(userId);
    const allLoans               = await loanService.getLoans(userId);

    const loanSummary = allLoans.reduce((acc, l) => {
      acc.total     += parseFloat(l.total_amount || 0);
      acc.paid      += parseFloat(l.paid_amount  || 0);
      acc.remaining += parseFloat(l.remaining    || 0);
      if (l.type === 'given') acc.netRemaining += parseFloat(l.remaining || 0);
      else                    acc.netRemaining -= parseFloat(l.remaining || 0);
      return acc;
    }, { total: 0, paid: 0, remaining: 0, netRemaining: 0 });

    const isLoan = (t) => t.is_loan === 1;

    const totalIncome     = transactions.filter(t => t.type === 'income'  && !isLoan(t)).reduce((s, t) => s + parseFloat(t.amount), 0);
    const totalExpenseAll = transactions.filter(t => t.type === 'expense' && !isLoan(t)).reduce((s, t) => s + parseFloat(t.amount), 0);
    const cashAdj         = await this.getCashAdjustment(userId);
    const accountsTotal   = await accountService.getTotalBalance(userId);
    const cashInHand      = accountsTotal > 0
      ? accountsTotal
      : totalIncome - totalExpenseAll + cashAdj;

    let totalSaved = 0, savingsProgress = 0;
    if (goalsData?.length > 0) {
      const totalTarget = goalsData.reduce((s, g) => s + parseFloat(g.target_amount), 0);
      totalSaved        = goalsData.reduce((s, g) => s + parseFloat(g.saved_amount || 0), 0);
      savingsProgress   = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
    }

    const allCategories = await transactionService.getCategories(userId);
    const categoryCache = Object.fromEntries((allCategories || []).map(c => [c.id, c]));

    const catTotals = {};
    let currentMonthlyExpense = 0;
    const now          = new Date();
    const currentMonth = now.getMonth();
    const currentYear  = now.getFullYear();

    transactions.filter(t => t.type === 'expense' && !isLoan(t)).forEach(t => {
      const d = new Date(t.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const amount = parseFloat(t.amount);
        currentMonthlyExpense += amount;
        const cat     = categoryCache[t.category_id];
        let dispCat   = cat;
        if (cat?.parent_id) dispCat = categoryCache[cat.parent_id] || cat;
        const catName = dispCat?.name || 'Other';
        if (!catTotals[catName]) catTotals[catName] = { amount: 0, color: dispCat?.color || '#4051b5' };
        catTotals[catName].amount += amount;
      }
    });

    const breakdown = Object.keys(catTotals).map(name => ({
      name,
      amount:  catTotals[name].amount,
      percent: currentMonthlyExpense > 0 ? (catTotals[name].amount / currentMonthlyExpense) * 100 : 0,
      color:   catTotals[name].color,
    })).sort((a, b) => b.amount - a.amount);

    const lastMonthDate    = new Date(); lastMonthDate.setMonth(now.getMonth() - 1);
    const lastMonthExpenses = transactions
      .filter(t => t.type === 'expense' && !isLoan(t))
      .filter(t => { const d = new Date(t.date); return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear(); })
      .reduce((s, t) => s + parseFloat(t.amount), 0);

    let expenseChange = 0;
    if (lastMonthExpenses > 0) expenseChange = ((currentMonthlyExpense - lastMonthExpenses) / lastMonthExpenses) * 100;
    else if (currentMonthlyExpense > 0) expenseChange = 100;

    let plannedData = [];
    try { plannedData = (await paymentService.getPlannedPayments(userId)).slice(0, 3); } catch {}

    const { data: rawBudgets } = await budgetService.getBudgets(userId);
    const budgetSummary = { totalBudget: 0, totalUsed: 0, count: 0 };

    (rawBudgets || []).forEach(raw => {
      const b               = decodeBudget(raw);
      const { start: activeStart, end: activeEnd } = getActivePeriod(b.start_date, b.frequency);
      const relatedIds      = getRelatedCategoryIds(b.category_id, allCategories);
      const spent           = transactions
        .filter(t => {
          const txDate = t.date.split('T')[0];
          return t.type === 'expense'
            && relatedIds.includes(t.category_id)
            && txDate >= activeStart
            && (!activeEnd || txDate <= activeEnd);
        })
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      budgetSummary.totalBudget += parseFloat(b.total_amount);
      budgetSummary.totalUsed   += spent;
      budgetSummary.count++;
    });

    return {
      recentTransactions: transactions.filter(t => !isLoan(t) && t.type !== 'transfer').slice(0, 5),
      recentLoans:        allLoans.filter(l => l.remaining > 0).slice(0, 3),
      recentPlanned:      plannedData,
      totals: {
        totalAmount:    cashInHand + loanSummary.netRemaining,
        incoming:       totalIncome,
        outgoing:       currentMonthlyExpense,
        monthlySpend:   currentMonthlyExpense,
        cashInHand,
        loan:           loanSummary,
        budget:         budgetSummary,
        totalIncome,
      },
      expenseChange,
      savingsProgress,
      categoryBreakdown:  breakdown,
      performanceMetrics: {
        balanceScore:  Math.min(Math.max((totalIncome / (totalExpenseAll || 1)) * 50, 0), 100),
        cashFlowScore: Math.min(Math.max(cashInHand > 0 ? 80 : 20, 0), 100),
      },
    };
  },

  async getReportData(userId, period = 'MONTH', customDates = null) {
    const { startDate, endDate } = period === 'CUSTOM' && customDates
      ? { startDate: new Date(customDates.startDate + 'T00:00:00'), endDate: new Date(customDates.endDate + 'T23:59:59') }
      : this._getDateRange(period);

    const db = getDb();
    const rows = await db.getAllAsync(
      "SELECT * FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ? ORDER BY date DESC",
      [userId, startDate.toISOString(), endDate.toISOString()]
    );

    const cats   = await transactionService.getCategories(userId);
    const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
    return rows.map(t => ({ ...t, categories: catMap[t.category_id] || null }));
  },
};

export default dashboardService;
