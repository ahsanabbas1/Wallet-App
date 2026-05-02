import { supabase } from '../lib/supabase';
import { transactionService } from './transactionService';
import savingsGoalService from './savingsGoalService';
import { paymentService } from './paymentService';
import { loanService } from './loanService';
import budgetService, { decodeBudget, getActivePeriod, getRelatedCategoryIds } from './budgetService';

export const dashboardService = {
  async getUserProfile(userId) {
    if (!userId) return null;
    const { data } = await supabase
      .from('users')
      .select('name, currency')
      .eq('id', userId)
      .single();
    return data || null;
  },

  _getDateRange(period = 'MONTH') {
    const now = new Date();
    const startDate = new Date(now);
    switch (period) {
      case 'WEEK':  startDate.setDate(now.getDate() - 7); break;
      case 'MONTH': startDate.setMonth(now.getMonth() - 1); break;
      case 'YEAR':  startDate.setFullYear(now.getFullYear() - 1); break;
      default:      startDate.setMonth(now.getMonth() - 1);
    }
    return { startDate, endDate: now };
  },

  async getDashboardData(userId) {
    await paymentService.syncDuePlannedPayments(userId).catch(() => {});

    const { data: transactions } = await transactionService.getTransactions(userId, { period: 'ALL' });
    const { data: goalsData } = await savingsGoalService.getSavingsGoals(userId);

    const allLoans = await loanService.getLoans(userId);
    const loanSummary = allLoans.reduce((acc, l) => {
      acc.total += parseFloat(l.total_amount || 0);
      acc.paid += parseFloat(l.paid_amount || 0);
      acc.remaining += parseFloat(l.remaining || 0);
      // For the "Total Amount" calculation, we treat given loans as assets and taken loans as liabilities?
      // User said: Total Amount = Loan + Cash in Hand. 
      // Usually this means: Current Balance + Net Owed to us.
      if (l.type === 'given') acc.netRemaining += parseFloat(l.remaining || 0);
      else acc.netRemaining -= parseFloat(l.remaining || 0);
      return acc;
    }, { total: 0, paid: 0, remaining: 0, netRemaining: 0 });

    const isLoan = (t) => {
      const title = (t.title || '').toLowerCase();
      return title.includes('loan');
    };

    const totalIncome = transactions
      .filter(t => t.type === 'income' && !isLoan(t))
      .reduce((s, t) => s + parseFloat(t.amount), 0);
      
    const totalExpenseAll = transactions
      .filter(t => t.type === 'expense' && !isLoan(t))
      .reduce((s, t) => s + parseFloat(t.amount), 0);

    const cashInHand = totalIncome - totalExpenseAll;

    let totalSaved = 0;
    let savingsProgress = 0;
    if (goalsData && goalsData.length > 0) {
      const totalTarget = goalsData.reduce((s, g) => s + parseFloat(g.target_amount), 0);
      totalSaved = goalsData.reduce((s, g) => s + parseFloat(g.saved_amount || 0), 0);
      savingsProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
    }

    const allCategories = await transactionService.getCategories(userId);
    const categoryCache = {};
    if (allCategories) allCategories.forEach(c => { categoryCache[c.id] = c; });

    const catTotals = {};
    let currentMonthlyExpense = 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    transactions.filter(t => t.type === 'expense' && !isLoan(t)).forEach(t => {
      const d = new Date(t.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const amount = parseFloat(t.amount);
        currentMonthlyExpense += amount;
        
        const category = categoryCache[t.category_id];
        let displayCategory = category;
        if (category?.parent_id) displayCategory = categoryCache[category.parent_id] || category;
        
        const catName = displayCategory?.name || 'Other';
        if (!catTotals[catName]) {
          catTotals[catName] = { amount: 0, color: displayCategory?.color || '#4051b5' };
        }
        catTotals[catName].amount += amount;
      }
    });

    const breakdown = Object.keys(catTotals).map(name => ({
      name,
      amount: catTotals[name].amount,
      percent: currentMonthlyExpense > 0 ? (catTotals[name].amount / currentMonthlyExpense) * 100 : 0,
      color: catTotals[name].color,
    })).sort((a, b) => b.amount - a.amount);

    const lastMonthDate = new Date();
    lastMonthDate.setMonth(now.getMonth() - 1);
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
      const b = decodeBudget(raw);
      const { start: activeStart, end: activeEnd } = getActivePeriod(b.start_date, b.frequency);
      const relatedIds = getRelatedCategoryIds(b.category_id, allCategories);
      
      const spent = transactions
        .filter(t => {
          const txDate = t.date.split('T')[0];
          const isInCategory = relatedIds.includes(t.category_id);
          const isInRange = txDate >= activeStart && (!activeEnd || txDate <= activeEnd);
          return t.type === 'expense' && isInCategory && isInRange;
        })
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      budgetSummary.totalBudget += parseFloat(b.total_amount);
      budgetSummary.totalUsed += spent;
      budgetSummary.count++;
    });

    return {
      recentTransactions: transactions.filter(t => !isLoan(t)).slice(0, 5),
      recentLoans: allLoans.filter(l => l.remaining > 0).slice(0, 3),
      recentPlanned: plannedData || [],
      totals: { 
        totalAmount: cashInHand + loanSummary.netRemaining,
        incoming: totalIncome,
        outgoing: currentMonthlyExpense,
        monthlySpend: currentMonthlyExpense,
        cashInHand,
        loan: loanSummary,
        budget: budgetSummary,
        totalIncome: totalIncome 
      },
      expenseChange,
      savingsProgress,
      categoryBreakdown: breakdown,
      performanceMetrics: {
        balanceScore: Math.min(Math.max((totalIncome / (totalExpenseAll || 1)) * 50, 0), 100),
        cashFlowScore: Math.min(Math.max(cashInHand > 0 ? 80 : 20, 0), 100),
      },
    };
  },

  async getReportData(userId, period = 'MONTH', customDates = null) {
    const { startDate, endDate } = period === 'CUSTOM' && customDates
      ? { startDate: new Date(customDates.startDate + 'T00:00:00'), endDate: new Date(customDates.endDate + 'T23:59:59') }
      : this._getDateRange(period);

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*, categories(name, color, icon)')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())
      .order('date', { ascending: false });

    if (error) throw error;
    return transactions || [];
  },
};

export default dashboardService;
