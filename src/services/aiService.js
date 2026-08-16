import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb, generateId } from '../lib/db';
import { transactionService } from './transactionService';
import { budgetService } from './budgetService';
import savingsGoalService from './savingsGoalService';
import { shoppingService } from './shoppingService';
import { paymentService } from './paymentService';

const DAILY_LIMIT = 10;

const dailyKey = (userId) => {
  const date = new Date().toISOString().split('T')[0];
  return `ai_usage_${userId}_${date}`;
};

export const fetchUsage = async (userId) => {
  const stored = await AsyncStorage.getItem(dailyKey(userId));
  return stored ? parseInt(stored, 10) : 0;
};

export const updateUsage = async (userId) => {
  const key = dailyKey(userId);
  const stored = await AsyncStorage.getItem(key);
  const newCount = (stored ? parseInt(stored, 10) : 0) + 1;
  await AsyncStorage.setItem(key, String(newCount));
  return newCount;
};

const PERIOD_LABELS = {
  '1M': 'Last 1 Month',
  '3M': 'Last 3 Months',
  '6M': 'Last 6 Months',
  '1Y': 'Last 1 Year',
  CUSTOM: 'Custom Range',
};

// Groups transactions by "Mon 'YY" label — same pattern as Reports' deriveChartData monthMap
const buildMonthlyBreakdown = (txns) => {
  const monthMap = {};
  txns.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.toLocaleString('default', { month: 'short' })} '${String(d.getFullYear()).slice(-2)}`;
    if (!monthMap[key]) monthMap[key] = { month: key, income: 0, expense: 0, sortDate: new Date(d.getFullYear(), d.getMonth(), 1) };
    const amt = parseFloat(t.amount);
    if (t.type === 'income') monthMap[key].income += amt;
    else monthMap[key].expense += amt;
  });
  return Object.values(monthMap)
    .sort((a, b) => a.sortDate - b.sortDate)
    .map(({ month, income, expense }) => ({ month, income, expense }));
};

export const getFinancialContext = async (userId, userCurrency, profileName, rangeOptions) => {
  try {
    const [txRes, budgetRes, goalRes, shoppingLists, plannedPayments, allCats, selectedRangeRes] = await Promise.all([
      transactionService.getTransactions(userId, { period: 'ALL' }),
      budgetService.getBudgets(userId),
      savingsGoalService.getSavingsGoals(userId),
      shoppingService.getLists(userId),
      paymentService.getPlannedPayments(userId),
      transactionService.getCategories(userId),
      rangeOptions
        ? transactionService.getTransactions(userId, {
            period: rangeOptions.period,
            customStartDate: rangeOptions.customStartDate,
            customEndDate: rangeOptions.customEndDate,
          })
        : Promise.resolve(null),
    ]);

    const catMap = Object.fromEntries((allCats || []).map(c => [c.id, c]));
    const currency = userCurrency;
    const transactions = (txRes.data || []).filter(t => t.is_loan !== 1);
    const budgets = budgetRes.data || [];
    const goals = goalRes.data || [];

    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthTxns = transactions.filter(t => new Date(t.date) >= firstDayThisMonth);
    const lastMonthTxns = transactions.filter(t => {
      const d = new Date(t.date);
      return d >= firstDayLastMonth && d <= lastDayLastMonth;
    });

    const sumExpenses = (txns) => txns.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
    const sumIncome = (txns) => txns.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);

    const catBreakdown = {};
    thisMonthTxns.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.categories?.name || 'Uncategorized';
      catBreakdown[cat] = (catBreakdown[cat] || 0) + parseFloat(t.amount);
    });

    const budgetStatus = budgets.map(b => {
      const spent = thisMonthTxns.filter(t => t.category_id === b.category_id && t.type === 'expense')
        .reduce((s, t) => s + parseFloat(t.amount), 0);
      return {
        category: catMap[b.category_id]?.name || 'Unknown',
        limit: parseFloat(b.total_amount),
        spent,
        percentUsed: b.total_amount > 0 ? ((spent / parseFloat(b.total_amount)) * 100).toFixed(1) : 0
      };
    });

    const goalsStatus = goals.map(g => ({
      title: g.title,
      target: parseFloat(g.target_amount),
      saved: parseFloat(g.saved_amount || 0),
      percent: g.target_amount > 0 ? ((parseFloat(g.saved_amount || 0) / parseFloat(g.target_amount)) * 100).toFixed(1) : 0,
      targetDate: g.target_date,
      repeatBasis: g.repeat_basis,
    }));

    const shoppingSummary = shoppingLists.map(l => ({
      title: l.title,
      totalItems: l.shopping_items?.length || 0,
      completedItems: l.shopping_items?.filter(i => i.is_completed).length || 0,
    }));

    const allExpenses = sumExpenses(transactions);
    const allIncome = sumIncome(transactions);

    const allCatBreakdown = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.categories?.name || 'Uncategorized';
      allCatBreakdown[cat] = (allCatBreakdown[cat] || 0) + parseFloat(t.amount);
    });
    const topCategories = Object.entries(allCatBreakdown)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));

    let selectedRange = null;
    if (rangeOptions && selectedRangeRes) {
      const rangeTxns = (selectedRangeRes.data || []).filter(t => t.is_loan !== 1);
      const rangeCatBreakdown = {};
      rangeTxns.filter(t => t.type === 'expense').forEach(t => {
        const cat = t.categories?.name || 'Uncategorized';
        rangeCatBreakdown[cat] = (rangeCatBreakdown[cat] || 0) + parseFloat(t.amount);
      });
      selectedRange = {
        label: PERIOD_LABELS[rangeOptions.period] || rangeOptions.period,
        startDate: rangeOptions.customStartDate || null,
        endDate: rangeOptions.customEndDate || null,
        expenses: sumExpenses(rangeTxns),
        income: sumIncome(rangeTxns),
        net: sumIncome(rangeTxns) - sumExpenses(rangeTxns),
        transactionCount: rangeTxns.length,
        categoryBreakdown: rangeCatBreakdown,
        monthlyBreakdown: buildMonthlyBreakdown(rangeTxns),
        recentTransactions: rangeTxns.slice(0, 30).map(t => ({
          title: t.title,
          amount: parseFloat(t.amount),
          type: t.type,
          category: t.categories?.name || 'Uncategorized',
          date: t.date,
          description: t.description,
        })),
      };
    }

    const context = {
      userName: profileName || 'User',
      currency,
      currentDate: now.toLocaleDateString(),
      currentMonth: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      thisMonth: {
        expenses: sumExpenses(thisMonthTxns),
        income: sumIncome(thisMonthTxns),
        net: sumIncome(thisMonthTxns) - sumExpenses(thisMonthTxns),
        transactionCount: thisMonthTxns.length,
        categoryBreakdown: catBreakdown,
      },
      lastMonth: {
        expenses: sumExpenses(lastMonthTxns),
        income: sumIncome(lastMonthTxns),
        net: sumIncome(lastMonthTxns) - sumExpenses(lastMonthTxns),
      },
      allTime: {
        totalExpenses: allExpenses,
        totalIncome: allIncome,
        netBalance: allIncome - allExpenses,
        totalTransactions: transactions.length,
        topSpendingCategories: topCategories,
      },
      selectedRange,
      recentTransactions: transactions.slice(0, 20).map(t => ({
        title: t.title,
        amount: parseFloat(t.amount),
        type: t.type,
        category: t.categories?.name || 'Uncategorized',
        date: t.date,
        description: t.description,
      })),
      budgets: budgetStatus,
      savingsGoals: goalsStatus,
      shoppingLists: shoppingSummary,
      plannedPayments: plannedPayments.slice(0, 10).map(p => ({
        title: p.title || p.name,
        amount: p.amount,
        nextDate: p.next_date || p.due_date,
        frequency: p.frequency,
      })),
    };

    return JSON.stringify(context);
  } catch (e) {
    console.warn('Context fetch failed', e);
    return JSON.stringify({ currency: userCurrency });
  }
};

export const saveChatMessage = async (userId, role, content) => {
  const db = getDb();
  const id = generateId();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO chat_messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, userId, role, content, createdAt]
  );
  return { id, role, content, createdAt };
};

export const getChatHistory = async (userId, limit = 50) => {
  const db = getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT ?',
    [userId, limit]
  );
  return rows.map(r => ({
    id: r.id,
    bubble: r.role === 'assistant' ? 'AI' : 'User',
    text: r.content,
    time: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: r.created_at,
  }));
};

export const clearChatHistory = async (userId) => {
  const db = getDb();
  await db.runAsync('DELETE FROM chat_messages WHERE user_id = ?', [userId]);
};

export { DAILY_LIMIT };
