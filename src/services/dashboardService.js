import { supabase } from '../lib/supabase';
import offlineSync from './offlineSync';
import { transactionService } from './transactionService';
import savingsGoalService from './savingsGoalService';
import { paymentService } from './paymentService';

export const dashboardService = {
  /**
   * Fetch user profile by id.
   */
  async getUserProfile(userId) {
    if (!userId) return null;
    const { data } = await offlineSync.getUserProfile(userId);
    return data || null;
  },

  /**
   * Get date range for a given period
   */
  _getDateRange(period = 'MONTH') {
    const now = new Date();
    const startDate = new Date(now);

    switch (period) {
      case 'WEEK':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'MONTH':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'YEAR':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    return { startDate, endDate: now };
  },

  /**
   * Fetch all dashboard stats and transactions.
   */
  async getDashboardData(userId) {
    await paymentService.syncDuePlannedPayments(userId).catch(() => {});
    const { data: transactions } = await transactionService.getTransactions(userId, { period: 'ALL' });

    const { data: goalsData } = await savingsGoalService.getSavingsGoals(userId);

    // 3. Aggregate Totals
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlySpend = transactions
      .filter(t => t.type === 'expense')
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    let totalSaved = 0;
    let savingsProgress = 0;
    if (goalsData && goalsData.length > 0) {
      const totalTarget = goalsData.reduce((sum, g) => sum + parseFloat(g.target_amount), 0);
      totalSaved = goalsData.reduce((sum, g) => sum + parseFloat(g.saved_amount || 0), 0);
      savingsProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
    }

    // 4. Category Breakdown (Rolling up sub-categories to parents)
    const categoryCache = {};
    const allCategories = await transactionService.getCategories(userId);
    if (allCategories) {
      allCategories.forEach((c) => {
        categoryCache[c.id] = c;
      });
    }

    const catTotals = {};
    let totalExpense = 0;

    transactions.filter(t => t.type === 'expense').forEach(t => {
      const category = categoryCache[t.category_id];
      let displayCategory = category;

      // If this is a sub-category, roll up to parent
      if (category?.parent_id) {
        displayCategory = categoryCache[category.parent_id] || category;
      }

      const catName = displayCategory?.name || 'Other';
      const amount = parseFloat(t.amount);

      if (!catTotals[catName]) {
        catTotals[catName] = {
          amount: 0,
          color: displayCategory?.color || '#4051b5'
        };
      }

      catTotals[catName].amount += amount;
      totalExpense += amount;
    });

    const breakdown = Object.keys(catTotals).map(name => ({
      name,
      amount: catTotals[name].amount,
      percent: totalExpense > 0 ? (catTotals[name].amount / totalExpense) * 100 : 0,
      color: catTotals[name].color
    })).sort((a,b) => b.amount - a.amount);


    // 5. Calculate vs Previous Month
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(now.getMonth() - 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    const lastMonthExpenses = transactions
      .filter(t => t.type === 'expense')
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      })
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    let expenseChange = 0;
    if (lastMonthExpenses > 0) {
      expenseChange = ((monthlySpend - lastMonthExpenses) / lastMonthExpenses) * 100;
    } else if (monthlySpend > 0) {
      expenseChange = 100; // 100% increase if no expenses last month
    }

    // 6. Fetch Planned Payments
    let plannedData = [];
    try {
      plannedData = (await paymentService.getPlannedPayments(userId)).slice(0, 3);
    } catch {}

    return {
      recentTransactions: transactions.slice(0, 5),
      recentPlanned: plannedData || [],
      totals: { balance: income - expense, monthlySpend, totalSaved, totalIncome: income },
      expenseChange,
      savingsProgress,
      categoryBreakdown: breakdown,
      performanceMetrics: {
        balanceScore: Math.min(Math.max((income / (expense || 1)) * 50, 0), 100),
        cashFlowScore: Math.min(Math.max((income - expense) > 0 ? 80 : 20, 0), 100)
      }
    };
  },

  /**
   * Get report data for a specific time period (pass customDates for CUSTOM period)
   */
  async getReportData(userId, period = 'MONTH', customDates = null) {
    const { startDate, endDate } = period === 'CUSTOM' && customDates
      ? { startDate: new Date(customDates.startDate + 'T00:00:00'), endDate: new Date(customDates.endDate + 'T23:59:59') }
      : this._getDateRange(period);

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        *,
        categories (
          name,
          color,
          icon
        )
      `)
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())
      .order('date', { ascending: false });

    if (error) throw error;
    return transactions || [];
  }
};
