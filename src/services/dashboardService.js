import { supabase } from '../lib/supabase';

export const dashboardService = {
  /**
   * Fetch user profile data.
   */
  async getUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: dbUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();
    
    return {
      id: user.id,
      name: dbUser?.name || user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0]
    };
  },

  /**
   * Fetch all dashboard stats and transactions.
   */
  async getDashboardData(userId) {
    // 1. Fetch Transactions
    const { data: transData, error: transError } = await supabase
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
      .order('date', { ascending: false });

    if (transError) throw transError;
    const transactions = transData || [];

    // 2. Fetch Goals
    const { data: goalsData } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', userId);
    
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

    // 4. Category Breakdown
    const catTotals = {};
    let totalExpense = 0;
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const catName = t.categories?.name || 'Other';
      const amount = parseFloat(t.amount);
      catTotals[catName] = (catTotals[catName] || 0) + amount;
      totalExpense += amount;
    });

    const breakdown = Object.keys(catTotals).map(name => ({
      name,
      amount: catTotals[name],
      percent: totalExpense > 0 ? (catTotals[name] / totalExpense) * 100 : 0,
      color: transactions.find(t => t.categories?.name === name)?.categories?.color || '#4051b5'
    })).sort((a,b) => b.amount - a.amount);

    return {
      recentTransactions: transactions.slice(0, 5),
      totals: { balance: income - expense, monthlySpend, totalSaved, totalIncome: income },
      savingsProgress,
      categoryBreakdown: breakdown,
      performanceMetrics: {
        balanceScore: Math.min(Math.max((income / (expense || 1)) * 50, 0), 100),
        cashFlowScore: Math.min(Math.max((income - expense) > 0 ? 80 : 20, 0), 100)
      }
    };
  }
};
