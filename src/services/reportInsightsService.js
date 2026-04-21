import { supabase } from '../lib/supabase';

/**
 * Calculate date range based on filter period
 */
export const getDateRange = (period) => {
  const now = new Date();
  const startDate = new Date(now);
  let label = '';

  switch (period) {
    case 'WEEK':
      startDate.setDate(now.getDate() - 7);
      label = 'Weekly';
      break;
    case 'MONTH':
      startDate.setMonth(now.getMonth() - 1);
      label = 'Monthly';
      break;
    case 'YEAR':
      startDate.setFullYear(now.getFullYear() - 1);
      label = 'Yearly';
      break;
    default:
      startDate.setMonth(now.getMonth() - 1);
      label = 'Monthly';
  }

  return { startDate, endDate: now, label, period };
};

/**
 * Get aggregated data for a time period
 */
export const getPeriodData = async (userId, period = 'MONTH') => {
  const { startDate, endDate } = getDateRange(period);

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
    .lte('date', endDate.toISOString());

  if (error) throw error;
  return transactions || [];
};

/**
 * Get previous period data for comparison
 */
export const getPreviousPeriodData = async (userId, period = 'MONTH') => {
  const now = new Date();
  let startDate = new Date(now);
  let prevEndDate = new Date(now);

  // Calculate previous period
  if (period === 'WEEK') {
    startDate.setDate(now.getDate() - 14);
    prevEndDate.setDate(now.getDate() - 7);
  } else if (period === 'MONTH') {
    startDate.setMonth(now.getMonth() - 2);
    prevEndDate.setMonth(now.getMonth());
  } else if (period === 'YEAR') {
    startDate.setFullYear(now.getFullYear() - 2);
    prevEndDate.setFullYear(now.getFullYear() - 1);
  }

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', startDate.toISOString())
    .lte('date', prevEndDate.toISOString());

  if (error) throw error;
  return transactions || [];
};

/**
 * Get user budgets for categories
 */
export const getUserBudgets = async (userId) => {
  const { data: budgets, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.warn('Could not fetch budgets:', error.message);
    return [];
  }
  return budgets || [];
};

/**
 * Analyze category spending and detect overspending
 */
export const analyzeSpending = (currentTransactions, previousTransactions, budgets) => {
  const categoryStats = {};

  // Process current period
  currentTransactions.forEach(t => {
    const catName = t.categories?.name || 'Other';
    if (!categoryStats[catName]) {
      categoryStats[catName] = {
        current: 0,
        previous: 0,
        categoryId: t.category_id,
        color: t.categories?.color || '#4051b5'
      };
    }
    categoryStats[catName].current += parseFloat(t.amount);
  });

  // Process previous period
  previousTransactions.forEach(t => {
    const catName = t.categories?.name || 'Other';
    if (!categoryStats[catName]) {
      categoryStats[catName] = {
        current: 0,
        previous: 0,
        categoryId: t.category_id,
        color: '#4051b5'
      };
    }
    categoryStats[catName].previous += parseFloat(t.amount);
  });

  // Calculate overspending and recommendations
  const overspending = [];
  const recommendations = [];

  Object.entries(categoryStats).forEach(([catName, stats]) => {
    const budget = budgets.find(b => b.category_id === stats.categoryId);
    const budgetLimit = budget ? parseFloat(budget.limit) : null;
    const historical = stats.previous;
    const current = stats.current;

    let overspent = false;
    let overspendAmount = 0;
    let overspendReason = '';

    // Check budget first
    if (budgetLimit && current > budgetLimit) {
      overspent = true;
      overspendAmount = current - budgetLimit;
      overspendReason = `Budget exceeded by PKR ${overspendAmount.toLocaleString()}`;
    }
    // Then check historical average (if > 20% higher)
    else if (historical > 0 && current > historical * 1.2) {
      overspent = true;
      overspendAmount = current - historical;
      const percentIncrease = ((current - historical) / historical * 100).toFixed(1);
      overspendReason = `${percentIncrease}% higher than usual`;
    }

    if (overspent) {
      overspending.push({
        category: catName,
        current,
        limit: budgetLimit || historical,
        overspendAmount,
        reason: overspendReason,
        color: stats.color
      });

      // Generate recommendation
      const targetAmount = budgetLimit || historical;
      const savePotential = current - targetAmount;
      const percentToReduce = ((savePotential / current) * 100).toFixed(1);

      recommendations.push({
        category: catName,
        current,
        target: targetAmount,
        savingsPotential: savePotential,
        percentToReduce,
        message: `Reduce ${catName} by ${percentToReduce}% to save PKR ${savePotential.toLocaleString()}`
      });
    }
  });

  return { categoryStats, overspending, recommendations };
};

/**
 * Calculate spending patterns
 */
export const analyzePatterns = (transactions, period = 'MONTH') => {
  const patterns = {
    topCategories: [],
    peakDay: null,
    peakDayAmount: 0,
    averageDailySpend: 0,
    totalSpend: 0,
    transactionCount: transactions.length
  };

  if (transactions.length === 0) {
    return patterns;
  }

  // Calculate total and average
  const totalSpend = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  patterns.totalSpend = totalSpend;

  // Get number of days in period
  const now = new Date();
  let daysInPeriod = 7; // default for week
  if (period === 'MONTH') {
    daysInPeriod = Math.ceil((now - new Date(now.getFullYear(), now.getMonth(), 1)) / (1000 * 60 * 60 * 24));
  } else if (period === 'YEAR') {
    daysInPeriod = 365;
  }
  patterns.averageDailySpend = totalSpend / daysInPeriod;

  // Find peak day
  const dailySpend = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  transactions.forEach(t => {
    const date = new Date(t.date);
    const dayName = dayNames[date.getDay()];
    const dateStr = date.toISOString().split('T')[0];
    const key = `${dayName} (${dateStr})`;

    dailySpend[key] = (dailySpend[key] || 0) + parseFloat(t.amount);
  });

  const maxDay = Object.entries(dailySpend).reduce((max, [day, amount]) =>
    amount > max[1] ? [day, amount] : max,
    ['', 0]
  );

  patterns.peakDay = maxDay[0];
  patterns.peakDayAmount = maxDay[1];

  // Get top spending categories
  const categoryTotals = {};
  transactions.forEach(t => {
    const catName = t.categories?.name || 'Other';
    categoryTotals[catName] = (categoryTotals[catName] || 0) + parseFloat(t.amount);
  });

  patterns.topCategories = Object.entries(categoryTotals)
    .map(([name, amount]) => ({
      name,
      amount,
      percent: (amount / totalSpend * 100).toFixed(1)
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return patterns;
};

/**
 * Generate smart insight text based on analysis
 */
export const generateInsightText = (patterns, overspending, currentSpend, previousSpend) => {
  const insights = [];

  // Overspending alert
  if (overspending.length > 0) {
    const categories = overspending.slice(0, 2).map(o => o.category).join(' and ');
    const totalOverspend = overspending.reduce((sum, o) => sum + o.overspendAmount, 0);
    insights.push(`⚠️ Overspending Alert: You've exceeded your limit in ${categories} by PKR ${totalOverspend.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`);
  } else if (previousSpend > 0) {
    const change = currentSpend - previousSpend;
    if (change < 0) {
      const percent = (Math.abs(change) / previousSpend * 100).toFixed(1);
      insights.push(`✓ Great job! You've spent ${percent}% less than the previous period.`);
    } else {
      const percent = (change / previousSpend * 100).toFixed(1);
      insights.push(`Spending increased by ${percent}% compared to the previous period.`);
    }
  }

  // Top spending categories
  if (patterns.topCategories.length > 0) {
    const topCats = patterns.topCategories.map(c => `${c.name} (${c.percent}%)`).join(', ');
    insights.push(`📊 Top spending: ${topCats}`);
  }

  // Average daily spend
  if (patterns.averageDailySpend > 0) {
    insights.push(`📈 Average daily spend: PKR ${patterns.averageDailySpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  }

  // Peak day
  if (patterns.peakDay) {
    insights.push(`📅 Peak spending day: ${patterns.peakDay} (PKR ${patterns.peakDayAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })})`);
  }

  return insights;
};

/**
 * Main function to get all insights
 */
export const getReportInsights = async (userId, period = 'MONTH') => {
  try {
    // Fetch data
    const currentTransactions = await getPeriodData(userId, period);
    const previousTransactions = await getPreviousPeriodData(userId, period);
    const budgets = await getUserBudgets(userId);

    // Calculate totals
    const currentSpend = currentTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const previousSpend = previousTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Analyze spending
    const { overspending, recommendations } = analyzeSpending(
      currentTransactions,
      previousTransactions,
      budgets
    );

    // Analyze patterns
    const patterns = analyzePatterns(currentTransactions, period);

    // Generate insight text
    const insightTexts = generateInsightText(patterns, overspending, currentSpend, previousSpend);

    return {
      currentSpend,
      previousSpend,
      overspending,
      recommendations: recommendations.slice(0, 3), // Top 3 recommendations
      patterns,
      insights: insightTexts,
      transactionCount: currentTransactions.length
    };
  } catch (error) {
    console.error('Error generating insights:', error);
    throw error;
  }
};
