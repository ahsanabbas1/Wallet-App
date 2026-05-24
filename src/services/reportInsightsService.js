import { getDb } from '../lib/db';
import { transactionService } from './transactionService';

export const getDateRange = (period, customDates = null) => {
  const now = new Date();

  if (period === 'CUSTOM' && customDates?.startDate && customDates?.endDate) {
    return {
      startDate: new Date(customDates.startDate + 'T00:00:00'),
      endDate:   new Date(customDates.endDate   + 'T23:59:59'),
      label: 'Custom', period,
    };
  }

  const startDate = new Date(now);
  let label = '';
  switch (period) {
    case 'WEEK':  startDate.setDate(now.getDate() - 7);         label = 'Weekly';  break;
    case 'MONTH': startDate.setMonth(now.getMonth() - 1);       label = 'Monthly'; break;
    case 'YEAR':  startDate.setFullYear(now.getFullYear() - 1); label = 'Yearly';  break;
    default:      startDate.setMonth(now.getMonth() - 1);       label = 'Monthly';
  }
  return { startDate, endDate: now, label, period };
};

async function fetchTransactionsWithCategories(userId, startDate, endDate, typeFilter = null) {
  const db  = getDb();
  let sql   = 'SELECT * FROM transactions WHERE user_id = ? AND date >= ? AND date <= ?';
  const p   = [userId, startDate.toISOString(), endDate.toISOString()];
  if (typeFilter) { sql += ' AND type = ?'; p.push(typeFilter); }

  const rows = await db.getAllAsync(sql, p);
  const cats = await transactionService.getCategories(userId);
  const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
  return rows.map(t => ({ ...t, categories: catMap[t.category_id] || null }));
}

export const getPeriodData = async (userId, period = 'MONTH', customDates = null) => {
  const { startDate, endDate } = getDateRange(period, customDates);
  return fetchTransactionsWithCategories(userId, startDate, endDate, 'expense');
};

export const getPreviousPeriodData = async (userId, period = 'MONTH') => {
  const now = new Date();
  let startDate = new Date(now), prevEndDate = new Date(now);
  if      (period === 'WEEK')  { startDate.setDate(now.getDate() - 14);          prevEndDate.setDate(now.getDate() - 7); }
  else if (period === 'MONTH') { startDate.setMonth(now.getMonth() - 2);         prevEndDate.setMonth(now.getMonth()); }
  else if (period === 'YEAR')  { startDate.setFullYear(now.getFullYear() - 2);   prevEndDate.setFullYear(now.getFullYear() - 1); }
  return fetchTransactionsWithCategories(userId, startDate, prevEndDate, 'expense');
};

export const getUserBudgets = async (userId) => {
  try {
    const db = getDb();
    return db.getAllAsync('SELECT * FROM budgets WHERE user_id = ?', [userId]);
  } catch (e) {
    console.warn('Could not fetch budgets:', e.message);
    return [];
  }
};

// Pure JS — unchanged from original
export const analyzeSpending = (currentTransactions, previousTransactions, budgets) => {
  const categoryStats = {};

  currentTransactions.forEach(t => {
    const catName = t.categories?.name || 'Other';
    if (!categoryStats[catName]) categoryStats[catName] = { current: 0, previous: 0, categoryId: t.category_id, color: t.categories?.color || '#4051b5' };
    categoryStats[catName].current += parseFloat(t.amount);
  });

  previousTransactions.forEach(t => {
    const catName = t.categories?.name || 'Other';
    if (!categoryStats[catName]) categoryStats[catName] = { current: 0, previous: 0, categoryId: t.category_id, color: '#4051b5' };
    categoryStats[catName].previous += parseFloat(t.amount);
  });

  const overspending = [], recommendations = [];
  Object.entries(categoryStats).forEach(([catName, stats]) => {
    const budget      = budgets.find(b => b.category_id === stats.categoryId);
    const budgetLimit = budget ? parseFloat(budget.limit) : null;
    const historical  = stats.previous;
    const current     = stats.current;
    let overspent = false, overspendAmount = 0, overspendReason = '';

    if (budgetLimit && current > budgetLimit) {
      overspent = true; overspendAmount = current - budgetLimit;
      overspendReason = `Budget exceeded by PKR ${overspendAmount.toLocaleString()}`;
    } else if (historical > 0 && current > historical * 1.2) {
      overspent = true; overspendAmount = current - historical;
      overspendReason = `${((current - historical) / historical * 100).toFixed(1)}% higher than usual`;
    }

    if (overspent) {
      overspending.push({ category: catName, current, limit: budgetLimit || historical, overspendAmount, reason: overspendReason, color: stats.color });
      const targetAmount = budgetLimit || historical;
      const savePotential = current - targetAmount;
      recommendations.push({
        category: catName, current, target: targetAmount, savingsPotential: savePotential,
        percentToReduce: ((savePotential / current) * 100).toFixed(1),
        message: `Reduce ${catName} by ${((savePotential / current) * 100).toFixed(1)}% to save PKR ${savePotential.toLocaleString()}`,
      });
    }
  });
  return { categoryStats, overspending, recommendations };
};

export const analyzePatterns = (transactions, period = 'MONTH') => {
  const patterns = { topCategories: [], peakDay: null, peakDayAmount: 0, averageDailySpend: 0, totalSpend: 0, transactionCount: transactions.length };
  if (transactions.length === 0) return patterns;

  const totalSpend = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  patterns.totalSpend = totalSpend;

  const now = new Date();
  let daysInPeriod = 7;
  if      (period === 'MONTH') daysInPeriod = Math.ceil((now - new Date(now.getFullYear(), now.getMonth(), 1)) / (1000 * 60 * 60 * 24));
  else if (period === 'YEAR')  daysInPeriod = 365;
  patterns.averageDailySpend = totalSpend / daysInPeriod;

  const dayNames   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dailySpend = {};
  transactions.forEach(t => {
    const date    = new Date(t.date);
    const dayName = dayNames[date.getDay()];
    const dateStr = date.toISOString().split('T')[0];
    const key     = `${dayName} (${dateStr})`;
    dailySpend[key] = (dailySpend[key] || 0) + parseFloat(t.amount);
  });

  const maxDay = Object.entries(dailySpend).reduce((max, [d, a]) => a > max[1] ? [d, a] : max, ['', 0]);
  patterns.peakDay = maxDay[0]; patterns.peakDayAmount = maxDay[1];

  const catTotals = {};
  transactions.forEach(t => { const n = t.categories?.name || 'Other'; catTotals[n] = (catTotals[n] || 0) + parseFloat(t.amount); });
  patterns.topCategories = Object.entries(catTotals)
    .map(([name, amount]) => ({ name, amount, percent: (amount / totalSpend * 100).toFixed(1) }))
    .sort((a, b) => b.amount - a.amount).slice(0, 3);

  return patterns;
};

export const generateInsightText = (patterns, overspending, currentSpend, previousSpend) => {
  const insights = [];
  if (overspending.length > 0) {
    const categories    = overspending.slice(0, 2).map(o => o.category).join(' and ');
    const totalOverspend = overspending.reduce((sum, o) => sum + o.overspendAmount, 0);
    insights.push(`⚠️ Overspending Alert: You've exceeded your limit in ${categories} by PKR ${totalOverspend.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`);
  } else if (previousSpend > 0) {
    const change = currentSpend - previousSpend;
    if (change < 0) insights.push(`✓ Great job! You've spent ${(Math.abs(change) / previousSpend * 100).toFixed(1)}% less than the previous period.`);
    else             insights.push(`Spending increased by ${(change / previousSpend * 100).toFixed(1)}% compared to the previous period.`);
  }
  if (patterns.topCategories.length > 0) insights.push(`📊 Top spending: ${patterns.topCategories.map(c => `${c.name} (${c.percent}%)`).join(', ')}`);
  if (patterns.averageDailySpend > 0)    insights.push(`📈 Average daily spend: PKR ${patterns.averageDailySpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  if (patterns.peakDay)                  insights.push(`📅 Peak spending day: ${patterns.peakDay} (PKR ${patterns.peakDayAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })})`);
  return insights;
};

export const getReportInsights = async (userId, period = 'MONTH', customDates = null) => {
  try {
    const [currentTransactions, previousTransactions, budgets] = await Promise.all([
      getPeriodData(userId, period, customDates),
      getPreviousPeriodData(userId, period),
      getUserBudgets(userId),
    ]);
    const currentSpend  = currentTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const previousSpend = previousTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const { overspending, recommendations } = analyzeSpending(currentTransactions, previousTransactions, budgets);
    const patterns     = analyzePatterns(currentTransactions, period);
    const insightTexts = generateInsightText(patterns, overspending, currentSpend, previousSpend);
    return { currentSpend, previousSpend, overspending, recommendations: recommendations.slice(0, 3), patterns, insights: insightTexts, transactionCount: currentTransactions.length };
  } catch (error) {
    console.error('Error generating insights:', error);
    throw error;
  }
};

export const getCashFlowData = async (userId, period = 'MONTH', customDates = null) => {
  try {
    const { startDate, endDate } = getDateRange(period, customDates);
    const transactions = await fetchTransactionsWithCategories(userId, startDate, endDate);
    const months = {};

    transactions.forEach(t => {
      const date     = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const dayKey   = date.toISOString().split('T')[0];
      if (!months[monthKey]) months[monthKey] = { month: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }), income: 0, expense: 0, net: 0, days: {} };
      if (!months[monthKey].days[dayKey]) months[monthKey].days[dayKey] = { date: dayKey, income: 0, expense: 0, net: 0 };
      const amount = parseFloat(t.amount);
      if (t.type === 'income') { months[monthKey].income += amount; months[monthKey].days[dayKey].income += amount; }
      else                     { months[monthKey].expense += amount; months[monthKey].days[dayKey].expense += amount; }
    });

    return Object.values(months).map(monthData => {
      monthData.net        = monthData.income - monthData.expense;
      monthData.isPositive = monthData.net >= 0;
      monthData.days       = Object.values(monthData.days).map(d => ({ ...d, net: d.income - d.expense, isPositive: d.net >= 0 })).sort((a, b) => new Date(a.date) - new Date(b.date));
      return monthData;
    });
  } catch (error) {
    console.error('Error generating cash flow data:', error);
    throw error;
  }
};

export const getLedgerData = async (userId, period = 'MONTH', customDates = null) => {
  try {
    const { startDate, endDate } = getDateRange(period, customDates);
    const db   = getDb();
    const cats = await transactionService.getCategories(userId);
    const catMap = Object.fromEntries(cats.map(c => [c.id, c]));

    const rows = await db.getAllAsync(
      'SELECT * FROM transactions WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC',
      [userId, startDate.toISOString(), endDate.toISOString()]
    );

    let runningBalance = 0;
    const ledgerTransactions = rows.map(t => {
      const amount = parseFloat(t.amount);
      const cat    = catMap[t.category_id] || null;
      runningBalance += t.type === 'income' ? amount : -amount;
      return {
        date:          new Date(t.date).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' }),
        dateISO:       t.date,
        description:   t.title,
        category:      cat?.name  || 'Other',
        categoryIcon:  cat?.icon  || null,
        categoryColor: cat?.color || '#4051b5',
        income:        t.type === 'income'  ? amount : 0,
        expense:       t.type === 'expense' ? amount : 0,
        runningBalance,
        type: t.type,
        id:   t.id,
      };
    }).reverse();

    const totalIncome  = rows.filter(t => t.type === 'income' ).reduce((s, t) => s + parseFloat(t.amount), 0);
    const totalExpense = rows.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);

    return { transactions: ledgerTransactions, summary: { totalIncome, totalExpense, netFlow: totalIncome - totalExpense } };
  } catch (error) {
    console.error('Error generating ledger data:', error);
    throw error;
  }
};

export const getChartData = async (userId, period = 'MONTH', customDates = null) => {
  try {
    const { startDate, endDate } = getDateRange(period, customDates);
    const transactions = await fetchTransactionsWithCategories(userId, startDate, endDate);

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const trendData = {}, barData = {}, incomeByCategory = {}, savingsData = {};

    transactions.forEach(t => {
      const date     = new Date(t.date);
      const monthKey = `${months[date.getMonth()]} '${String(date.getFullYear()).slice(-2)}`;
      if (!trendData[monthKey]) trendData[monthKey] = { month: monthKey, amount: 0, date };
      if (!barData[monthKey])   barData[monthKey]   = { month: monthKey, income: 0, expense: 0, date };
      const amount = parseFloat(t.amount);
      if (t.type === 'expense') trendData[monthKey].amount  += amount;
      if (t.type === 'income')  barData[monthKey].income    += amount;
      else                      barData[monthKey].expense   += amount;
      if (t.type === 'income') {
        const n = t.categories?.name || 'Other';
        incomeByCategory[n] = (incomeByCategory[n] || 0) + amount;
      }
    });

    const trendLine        = Object.values(trendData).sort((a, b) => a.date - b.date).map(({ month, amount }) => ({ month, amount }));
    const incomeExpenseBar = Object.values(barData).sort((a, b) => a.date - b.date).map(({ month, income, expense }) => ({ month, income, expense }));

    const totalIncome    = Object.values(incomeByCategory).reduce((s, a) => s + a, 0);
    const incomeBreakdown = Object.entries(incomeByCategory)
      .map(([category, amount]) => ({
        name: category, amount,
        percent: totalIncome > 0 ? (amount / totalIncome * 100).toFixed(1) : 0,
        color: transactions.find(t => t.categories?.name === category && t.type === 'income')?.categories?.color || '#4051b5',
      }))
      .sort((a, b) => b.amount - a.amount);

    let cumulativeSavings = 0;
    [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
      const date     = new Date(t.date);
      const monthKey = `${months[date.getMonth()]} '${String(date.getFullYear()).slice(-2)}`;
      if (!savingsData[monthKey]) savingsData[monthKey] = { month: monthKey, cumulativeSavings: 0, date };
      cumulativeSavings += t.type === 'income' ? parseFloat(t.amount) : -parseFloat(t.amount);
      savingsData[monthKey].cumulativeSavings = cumulativeSavings;
    });
    const savingsArea = Object.values(savingsData).sort((a, b) => a.date - b.date).map(({ month, cumulativeSavings }) => ({ month, cumulativeSavings }));

    return { trendLine, incomeExpenseBar, incomeBreakdown, savingsArea };
  } catch (error) {
    console.error('Error generating chart data:', error);
    throw error;
  }
};
