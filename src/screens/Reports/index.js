import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal,
  ActivityIndicator, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import {
  Menu, CalendarDays, X,
  TrendingUp, TrendingDown, ArrowUp, ArrowDown,
  AlertTriangle, Lightbulb, BarChart3,
  Table2, List as ListIcon, Activity,
} from 'lucide-react-native';
import { useDrawer }       from '../../context/DrawerContext';
import { useAuth }         from '../../context/AuthContext';
import { useProfile }      from '../../context/ProfileContext';
import { supabase }        from '../../lib/supabase';
import { useFocusEffect }  from '@react-navigation/native';

import MiniCalendar            from '../../components/Calendar';
import CashFlowTable           from '../../components/CashFlowTable';
import LedgerTable             from '../../components/LedgerTable';
import LedgerList              from '../../components/LedgerList';
import LineChart               from '../../components/Charts/LineChart';
import IncomeExpenseBarChart   from '../../components/Charts/IncomeExpenseBarChart';
import SavingsAreaChart        from '../../components/Charts/SavingsAreaChart';

import { styles } from './styles';

/* ─── helpers ────────────────────────────────────────────────────────────── */

const today = () => new Date().toISOString().split('T')[0];

// Currency formatter — currency injected at call-site from ProfileContext
const fmtAmt = (currency) => (n = 0, decimals = 0) =>
  `${currency} ${Math.abs(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: decimals })}`;

const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${mo[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ─── constants ──────────────────────────────────────────────────────────── */

const PERIOD_FILTERS = [
  { label: 'Week',  value: 'WEEK'  },
  { label: 'Month', value: 'MONTH' },
  { label: 'Year',  value: 'YEAR'  },
];

const TABS = ['Overview', 'Analytics', 'Book'];

/* ─── pure data builders (no hooks, no Supabase) ─────────────────────────── */

const buildDateRange = (period, customDates) => {
  const now = new Date();
  if (period === 'CUSTOM' && customDates) {
    return {
      start: new Date(customDates.startDate + 'T00:00:00'),
      end:   new Date(customDates.endDate   + 'T23:59:59'),
    };
  }
  const start = new Date(now);
  if (period === 'WEEK')  start.setDate(now.getDate() - 7);
  else if (period === 'YEAR') start.setFullYear(now.getFullYear() - 1);
  else start.setMonth(now.getMonth() - 1);          // MONTH default
  return { start, end: now };
};

const buildPrevRange = (period, currentStart) => {
  const duration = new Date() - currentStart;
  const prevEnd   = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration);
  return { start: prevStart, end: prevEnd };
};

/* ─── single unified Supabase fetch ─────────────────────────────────────── */

const fetchAllReportData = async (userId, period, customDates) => {
  const { start, end } = buildDateRange(period, customDates);
  const { start: pStart, end: pEnd } = buildPrevRange(period, start);

  // Batch: current + previous + 6-month bar data
  const [curRes, prevRes, ...monthRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, amount, type, date, category_id, categories(name, color, icon)')
      .eq('user_id', userId)
      .gte('date', start.toISOString())
      .lte('date', end.toISOString())
      .order('date', { ascending: true }),

    supabase
      .from('transactions')
      .select('id, amount, type, date, categories(name, color)')
      .eq('user_id', userId)
      .gte('date', pStart.toISOString())
      .lte('date', pEnd.toISOString()),

    // 6 individual month queries in parallel
    ...Array.from({ length: 6 }, (_, i) => {
      const now = new Date();
      const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', userId)
        .gte('date', new Date(d.getFullYear(), d.getMonth(), 1).toISOString())
        .lt('date',  new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString());
    }),
  ]);

  const current  = curRes.data  || [];
  const previous = prevRes.data || [];

  // 6-month trend bars
  const sixMonthBars = monthRes.map((res, i) => {
    const now = new Date();
    const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const txs = res.data || [];
    return {
      label:   MONTH_NAMES[d.getMonth()],
      expense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0),
      income:  txs.filter(t => t.type === 'income') .reduce((s, t) => s + parseFloat(t.amount), 0),
    };
  });

  return { current, previous, sixMonthBars, rangeStart: start, rangeEnd: end };
};

/* ─── derived data builders (memoised in component) ─────────────────────── */

const deriveMetrics = (current, previous) => {
  const income  = current.filter(t => t.type === 'income') .reduce((s, t) => s + parseFloat(t.amount), 0);
  const expense = current.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const net     = income - expense;

  const prevExpense = previous.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const prevIncome  = previous.filter(t => t.type === 'income') .reduce((s, t) => s + parseFloat(t.amount), 0);

  const expenseChange = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0;
  const incomeChange  = prevIncome  > 0 ? ((income  - prevIncome)  / prevIncome)  * 100 : 0;

  return { income, expense, net, prevExpense, prevIncome, expenseChange, incomeChange };
};

const deriveBreakdown = (current, totalExpense) => {
  const map = {};
  current.filter(t => t.type === 'expense').forEach(t => {
    const n = t.categories?.name || 'Other';
    if (!map[n]) map[n] = { amount: 0, color: t.categories?.color || COLORS.primary };
    map[n].amount += parseFloat(t.amount);
  });
  return Object.entries(map)
    .map(([label, { amount, color }]) => ({
      label, amount, color,
      percent: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
};

const deriveCategoryVariance = (current, previous) => {
  const prevMap = {};
  previous.filter(t => t.type === 'expense').forEach(t => {
    const n = t.categories?.name || 'Other';
    prevMap[n] = (prevMap[n] || 0) + parseFloat(t.amount);
  });
  const currMap = {};
  current.filter(t => t.type === 'expense').forEach(t => {
    const n = t.categories?.name || 'Other';
    currMap[n] = (currMap[n] || 0) + parseFloat(t.amount);
  });
  const result = {};
  Object.keys({ ...currMap, ...prevMap }).forEach(n => {
    const c = currMap[n] || 0, p = prevMap[n] || 0;
    result[n] = p > 0 ? ((c - p) / p) * 100 : (c > 0 ? 100 : 0);
  });
  return result;
};

const deriveInsights = (metrics, breakdown, catVariance, fmt) => {
  const tips = [];
  const { expense, expenseChange, income, net } = metrics;

  if (expenseChange > 15)
    tips.push({ type: 'warn', text: `Spending is up ${expenseChange.toFixed(1)}% vs last period.` });
  else if (expenseChange < -10)
    tips.push({ type: 'good', text: `Great job! Spending is down ${Math.abs(expenseChange).toFixed(1)}% vs last period.` });

  if (net > 0)
    tips.push({ type: 'good', text: `You saved ${fmt(net)} this period (${income > 0 ? ((net / income) * 100).toFixed(0) : 0}% of income).` });
  else if (net < 0)
    tips.push({ type: 'warn', text: `Expenses exceeded income by ${fmt(Math.abs(net))} this period.` });

  const topCat = breakdown[0];
  if (topCat && expense > 0)
    tips.push({ type: 'info', text: `${topCat.label} is your biggest expense at ${topCat.percent.toFixed(0)}% of total spending.` });

  const risingCats = Object.entries(catVariance)
    .filter(([, v]) => v > 25)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);
  risingCats.forEach(([name, pct]) =>
    tips.push({ type: 'warn', text: `${name} spending rose ${pct.toFixed(0)}% compared to last period.` })
  );

  return tips;
};

const deriveChartData = (current, sixMonthBars) => {
  // Monthly grouped data for line + bar charts
  const monthMap = {};
  current.forEach(t => {
    const d  = new Date(t.date);
    const mk = `${MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
    if (!monthMap[mk]) monthMap[mk] = { month: mk, income: 0, expense: 0, date: d };
    const a = parseFloat(t.amount);
    if (t.type === 'income') monthMap[mk].income += a;
    else monthMap[mk].expense += a;
  });
  const sorted = Object.values(monthMap).sort((a, b) => a.date - b.date);

  const trendLine       = sorted.map(({ month, expense }) => ({ label: month, amount: expense }));
  const incomeExpBar    = sorted.map(({ month, income, expense }) => ({ month, income, expense }));

  let cumSavings = 0;
  const savingsArea = sorted.map(({ month, income, expense }) => {
    cumSavings += income - expense;
    return { month, cumulativeSavings: cumSavings };
  });

  // Income breakdown
  const incomeMap = {};
  current.filter(t => t.type === 'income').forEach(t => {
    const n = t.categories?.name || 'Other';
    if (!incomeMap[n]) incomeMap[n] = { amount: 0, color: t.categories?.color || '#4051b5' };
    incomeMap[n].amount += parseFloat(t.amount);
  });
  const totalIncome = Object.values(incomeMap).reduce((s, v) => s + v.amount, 0);
  const incomeBreakdown = Object.entries(incomeMap)
    .map(([name, { amount, color }]) => ({ name, amount, color, percent: totalIncome > 0 ? (amount / totalIncome * 100).toFixed(1) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  return { trendLine, incomeExpBar, savingsArea, incomeBreakdown };
};

const deriveCashFlow = (current) => {
  const months = {};
  current.forEach(t => {
    const d  = new Date(t.date);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const dk = d.toISOString().split('T')[0];
    if (!months[mk]) months[mk] = {
      month: d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
      income: 0, expense: 0, net: 0, days: {}
    };
    if (!months[mk].days[dk]) months[mk].days[dk] = { date: dk, income: 0, expense: 0, net: 0 };
    const a = parseFloat(t.amount);
    if (t.type === 'income') {
      months[mk].income += a;
      months[mk].days[dk].income += a;
    } else {
      months[mk].expense += a;
      months[mk].days[dk].expense += a;
    }
  });
  return Object.values(months).map(m => {
    m.net = m.income - m.expense;
    m.isPositive = m.net >= 0;
    m.days = Object.values(m.days).map(d => ({ ...d, net: d.income - d.expense }))
              .sort((a, b) => new Date(a.date) - new Date(b.date));
    return m;
  });
};

const deriveLedger = (current) => {
  let balance = 0;
  const txs = [...current].sort((a, b) => new Date(a.date) - new Date(b.date)).map(t => {
    const a = parseFloat(t.amount);
    balance += t.type === 'income' ? a : -a;
    return {
      id:             t.id,
      date:           new Date(t.date).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' }),
      dateISO:        t.date,
      description:    t.title || '—',
      category:       t.categories?.name || 'Other',
      categoryColor:  t.categories?.color || '#4051b5',
      income:         t.type === 'income'  ? a : 0,
      expense:        t.type === 'expense' ? a : 0,
      runningBalance: balance,
      type:           t.type,
    };
  });
  const totalIncome  = txs.reduce((s, t) => s + t.income,  0);
  const totalExpense = txs.reduce((s, t) => s + t.expense, 0);
  return {
    transactions: txs.reverse(),
    summary: { totalIncome, totalExpense, netFlow: totalIncome - totalExpense },
  };
};

/* ════════════════════════════════════════════════════════════════════════════
   REPORTS SCREEN
   ════════════════════════════════════════════════════════════════════════════ */

const Reports = () => {
  const { openDrawer }       = useDrawer();
  const { userId }           = useAuth();
  const { currency }         = useProfile();
  const fmt                  = React.useMemo(() => fmtAmt(currency), [currency]);

  /* ── period / date state ──────────────────────────────────────────── */
  const [filterPeriod,   setFilterPeriod]   = useState('MONTH');
  const [customStart,    setCustomStart]    = useState(today());
  const [customEnd,      setCustomEnd]      = useState(today());
  const [appliedStart,   setAppliedStart]   = useState('');
  const [appliedEnd,     setAppliedEnd]     = useState('');
  const [isCustomActive, setIsCustomActive] = useState(false);

  /* ── modal ────────────────────────────────────────────────────────── */
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTab,     setPickerTab]     = useState('FROM');

  /* ── UI ───────────────────────────────────────────────────────────── */
  const [activeTab,  setActiveTab]  = useState(0);
  const [ledgerView, setLedgerView] = useState('TABLE');
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState(false);

  /* ── raw data from Supabase (single fetch) ────────────────────────── */
  const [rawData, setRawData] = useState({
    current: [], previous: [], sixMonthBars: [],
  });

  const effectivePeriod = isCustomActive ? 'CUSTOM' : filterPeriod;
  const customDates     = isCustomActive ? { startDate: appliedStart, endDate: appliedEnd } : null;

  /* ── fetch ────────────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setFetchError(false);
      const data = await fetchAllReportData(userId, effectivePeriod, customDates);
      setRawData(data);
    } catch (err) {
      console.error('Reports fetch error:', err.message);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [userId, effectivePeriod, appliedStart, appliedEnd]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // Realtime: re-fetch when transactions change
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`reports_realtime_${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        () => fetchData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  /* ── memoised derived data ───────────────────────────────────────── */
  const metrics        = useMemo(() => deriveMetrics(rawData.current, rawData.previous),                      [rawData]);
  const breakdown      = useMemo(() => deriveBreakdown(rawData.current, metrics.expense),                      [rawData, metrics.expense]);
  const catVariance    = useMemo(() => deriveCategoryVariance(rawData.current, rawData.previous),             [rawData]);
  const insights       = useMemo(() => deriveInsights(metrics, breakdown, catVariance, fmt),                  [metrics, breakdown, catVariance, fmt]);
  const chartData      = useMemo(() => deriveChartData(rawData.current, rawData.sixMonthBars),       [rawData]);
  const cashFlowData   = useMemo(() => deriveCashFlow(rawData.current),                              [rawData]);
  const ledgerData     = useMemo(() => deriveLedger(rawData.current),                                [rawData]);

  const maxBarExpense  = useMemo(
    () => Math.max(...rawData.sixMonthBars.map(b => b.expense), 1),
    [rawData.sixMonthBars]
  );

  /* ── period label ─────────────────────────────────────────────────── */
  const periodLabel = isCustomActive
    ? `${fmtDate(appliedStart)} – ${fmtDate(appliedEnd)}`
    : { WEEK: 'Past 7 Days', MONTH: 'Past 30 Days', YEAR: 'Past 12 Months' }[filterPeriod];

  /* ── date picker actions ──────────────────────────────────────────── */
  const openPicker = () => {
    setCustomStart(appliedStart || today());
    setCustomEnd(appliedEnd || today());
    setPickerTab('FROM');
    setPickerVisible(true);
  };
  const applyRange = () => {
    setAppliedStart(customStart);
    setAppliedEnd(customEnd);
    setIsCustomActive(true);
    setPickerVisible(false);
  };
  const clearRange = () => {
    setIsCustomActive(false);
    setAppliedStart('');
    setAppliedEnd('');
    setFilterPeriod('MONTH');
  };
  const selectPreset = (v) => {
    setFilterPeriod(v);
    setIsCustomActive(false);
    setAppliedStart('');
    setAppliedEnd('');
  };

  /* ── render ───────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (fetchError) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Text style={{ color: COLORS.error, fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>Failed to load reports</Text>
        <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 }}>Check your connection and try again.</Text>
        <Pressable
          style={{ backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}
          onPress={fetchData}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.7 }]} onPress={openDrawer}>
            <Menu color={COLORS.text} size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Reports</Text>
          <Pressable style={[styles.calendarBtn, isCustomActive && styles.calendarBtnActive]} onPress={openPicker}>
            <CalendarDays color={isCustomActive ? '#fff' : COLORS.textSecondary} size={18} />
          </Pressable>
        </View>

        {/* ── Period filter pills ─────────────────────────────────── */}
        <View style={styles.filterRow}>
          <View style={styles.filterPills}>
            {PERIOD_FILTERS.map(f => (
              <Pressable
                key={f.value}
                style={[styles.filterButton, !isCustomActive && filterPeriod === f.value && styles.filterButtonActive]}
                onPress={() => selectPreset(f.value)}
              >
                <Text style={[styles.filterButtonText, !isCustomActive && filterPeriod === f.value && styles.filterButtonTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Custom range badge ──────────────────────────────────── */}
        {isCustomActive && (
          <View style={styles.rangeBadge}>
            <CalendarDays color={COLORS.primary} size={13} />
            <Text style={styles.rangeBadgeText}>{fmtDate(appliedStart)} – {fmtDate(appliedEnd)}</Text>
            <Pressable style={styles.rangeBadgeClear} onPress={clearRange}>
              <X color={COLORS.primary} size={11} />
            </Pressable>
          </View>
        )}

        {/* ── Hero card ───────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <Text style={styles.heroPeriod}>{periodLabel}</Text>
          <Text style={styles.heroAmount}>{fmt(metrics.expense, 0)}</Text>
          <Text style={styles.heroLabel}>Total Expenses</Text>

          {/* Trend badge */}
          <View style={styles.heroTrend}>
            <View style={[styles.heroTrendBadge, {
              backgroundColor: metrics.expenseChange > 0 ? 'rgba(244,67,54,0.2)' : 'rgba(11,218,115,0.2)',
            }]}>
              {metrics.expenseChange > 0
                ? <ArrowUp   color="#f44336" size={12} />
                : <ArrowDown color="#0bda73" size={12} />}
              <Text style={[styles.heroTrendText, { color: metrics.expenseChange > 0 ? '#f44336' : '#0bda73' }]}>
                {Math.abs(metrics.expenseChange).toFixed(1)}%
              </Text>
            </View>
            <Text style={styles.heroTrendLabel}>vs previous period</Text>
          </View>

          {/* Income / Net / Expense row */}
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Income</Text>
              <Text style={[styles.heroStatValue, { color: '#0bda73' }]}>{fmt(metrics.income)}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Net</Text>
              <Text style={[styles.heroStatValue, { color: metrics.net >= 0 ? '#0bda73' : '#f44336' }]}>
                {metrics.net >= 0 ? '+' : '-'}{fmt(Math.abs(metrics.net))}
              </Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Transactions</Text>
              <Text style={styles.heroStatValue}>{rawData.current.length}</Text>
            </View>
          </View>
        </View>

        {/* ── Tab bar ─────────────────────────────────────────────── */}
        <View style={styles.tabBar}>
          {TABS.map((tab, i) => (
            <Pressable key={tab} style={[styles.tab, activeTab === i && styles.tabActive]} onPress={() => setActiveTab(i)}>
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{tab}</Text>
            </Pressable>
          ))}
        </View>

        {/* ══════════════════════════════════════════════════════════
            TAB 0 — OVERVIEW
            ══════════════════════════════════════════════════════════ */}
        {activeTab === 0 && (
          <>
            {/* 6-month mini bars */}
            <View style={styles.chartCard}>
              <Text style={styles.chartCardTitle}>6-Month Snapshot</Text>
              <View style={styles.inlineBarChart}>
                {rawData.sixMonthBars.map((bar, i) => {
                  const isLast = i === rawData.sixMonthBars.length - 1;
                  const h = Math.max((bar.expense / maxBarExpense) * 100, 4);
                  return (
                    <View key={i} style={styles.inlineBarWrap}>
                      <View style={[styles.inlineBar, {
                        height: `${h}%`,
                        backgroundColor: isLast ? COLORS.primary : 'rgba(64,81,181,0.35)',
                      }]} />
                      <Text style={[styles.inlineBarLabel, isLast && styles.inlineBarLabelActive]}>
                        {bar.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* KPI row */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Avg / Day</Text>
                <Text style={[styles.kpiValue, { color: COLORS.text }]}>
                  {fmt(metrics.expense / Math.max(rawData.current.filter(t => t.type === 'expense').length || 1, 1))}
                </Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Savings Rate</Text>
                <Text style={[styles.kpiValue, { color: metrics.net >= 0 ? '#0bda73' : '#f44336' }]}>
                  {metrics.income > 0 ? ((metrics.net / metrics.income) * 100).toFixed(0) : 0}%
                </Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Categories</Text>
                <Text style={[styles.kpiValue, { color: COLORS.text }]}>{breakdown.length}</Text>
              </View>
            </View>

            {/* Spending breakdown */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Spending Breakdown</Text>
                <Text style={styles.sectionSubtitle}>{breakdown.length} categories</Text>
              </View>
            </View>

            <View style={styles.breakdownCard}>
              {breakdown.length > 0 ? breakdown.map((item, i) => {
                const variance = catVariance[item.label] || 0;
                return (
                  <View key={i} style={styles.breakdownRow}>
                    <View style={styles.breakdownMeta}>
                      <View style={styles.breakdownLeft}>
                        <View style={[styles.catDot, { backgroundColor: item.color }]} />
                        <Text style={styles.catName}>{item.label}</Text>
                        {Math.abs(variance) > 1 && (
                          <View style={styles.catVariance}>
                            {variance > 0
                              ? <ArrowUp color="#f44336" size={11} />
                              : <ArrowDown color="#0bda73" size={11} />}
                            <Text style={[styles.catVarianceText, { color: variance > 0 ? '#f44336' : '#0bda73' }]}>
                              {Math.abs(variance).toFixed(0)}%
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.catAmount}>{fmt(item.amount)}</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, {
                        width: `${Math.max(item.percent, 1)}%`,
                        backgroundColor: item.color,
                      }]} />
                    </View>
                  </View>
                );
              }) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No expense data for this period.</Text>
                </View>
              )}
            </View>

            {/* Smart Insights */}
            {insights.length > 0 && (
              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View style={styles.insightIconWrap}>
                    <Lightbulb color={COLORS.primary} size={18} />
                  </View>
                  <Text style={styles.insightTitle}>Smart Insights</Text>
                </View>
                {insights.map((item, i) => (
                  <Text key={i} style={styles.insightItem}>
                    {item.type === 'good' ? '✅ ' : item.type === 'warn' ? '⚠️ ' : 'ℹ️ '}
                    {item.text}
                  </Text>
                ))}
              </View>
            )}

            {/* Alerts for overspending categories */}
            {Object.entries(catVariance).filter(([, v]) => v > 25).length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Overspending Alerts</Text>
                </View>
                {Object.entries(catVariance)
                  .filter(([, v]) => v > 25)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([cat, pct], i) => {
                    const catData = breakdown.find(b => b.label === cat);
                    return (
                      <View key={i} style={[styles.alertCard, { backgroundColor: 'rgba(244,67,54,0.08)', borderLeftWidth: 3, borderLeftColor: '#f44336' }]}>
                        <View style={[styles.alertIconWrap, { backgroundColor: 'rgba(244,67,54,0.15)' }]}>
                          <AlertTriangle color="#f44336" size={16} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.alertTitle}>{cat}</Text>
                          <Text style={styles.alertBody}>
                            {pct.toFixed(0)}% higher than previous period
                          </Text>
                          {catData && (
                            <Text style={[styles.alertValue, { color: '#f44336' }]}>
                              {fmt(catData.amount)} spent
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 1 — ANALYTICS
            ══════════════════════════════════════════════════════════ */}
        {activeTab === 1 && (
          <>
            {/* KPI summary row */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total Income</Text>
                <Text style={[styles.kpiValue, { color: '#0bda73' }]}>{fmt(metrics.income)}</Text>
                <View style={styles.kpiChange}>
                  {metrics.incomeChange >= 0
                    ? <TrendingUp  color="#0bda73" size={12} />
                    : <TrendingDown color="#f44336" size={12} />}
                  <Text style={[styles.kpiChangeText, { color: metrics.incomeChange >= 0 ? '#0bda73' : '#f44336' }]}>
                    {Math.abs(metrics.incomeChange).toFixed(1)}%
                  </Text>
                </View>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total Expense</Text>
                <Text style={[styles.kpiValue, { color: '#f44336' }]}>{fmt(metrics.expense)}</Text>
                <View style={styles.kpiChange}>
                  {metrics.expenseChange <= 0
                    ? <TrendingDown color="#0bda73" size={12} />
                    : <TrendingUp  color="#f44336" size={12} />}
                  <Text style={[styles.kpiChangeText, { color: metrics.expenseChange <= 0 ? '#0bda73' : '#f44336' }]}>
                    {Math.abs(metrics.expenseChange).toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>

            {/* Income vs Expenses */}
            <View style={styles.chartCard}>
              <Text style={styles.chartCardTitle}>Income vs Expenses</Text>
              <IncomeExpenseBarChart data={chartData.incomeExpBar} height={200} />
            </View>

            {/* Spending trend line */}
            <View style={styles.chartCard}>
              <Text style={styles.chartCardTitle}>Expense Trend</Text>
              <LineChart
                data={chartData.trendLine}
                color={COLORS.primary}
                height={180}
              />
            </View>

            {/* Savings trajectory */}
            <View style={styles.chartCard}>
              <Text style={styles.chartCardTitle}>Cumulative Savings</Text>
              <SavingsAreaChart data={chartData.savingsArea} height={180} />
            </View>

            {/* Income breakdown */}
            {chartData.incomeBreakdown.length > 0 && (
              <View style={styles.breakdownCard}>
                <Text style={[styles.chartCardTitle, { marginBottom: 14 }]}>Income Sources</Text>
                {chartData.incomeBreakdown.map((item, i) => (
                  <View key={i} style={styles.breakdownRow}>
                    <View style={styles.breakdownMeta}>
                      <View style={styles.breakdownLeft}>
                        <View style={[styles.catDot, { backgroundColor: item.color }]} />
                        <Text style={styles.catName}>{item.name}</Text>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginLeft: 6 }}>
                          {item.percent}%
                        </Text>
                      </View>
                      <Text style={[styles.catAmount, { color: '#0bda73' }]}>{fmt(item.amount)}</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, {
                        width: `${Math.max(parseFloat(item.percent), 1)}%`,
                        backgroundColor: item.color,
                      }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Cash Flow table */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Cash Flow</Text>
                <Text style={styles.sectionSubtitle}>Tap a month to expand daily view</Text>
              </View>
              <BarChart3 color={COLORS.textSecondary} size={18} />
            </View>
            <View style={{ paddingHorizontal: 0, marginBottom: 8 }}>
              <CashFlowTable data={cashFlowData} />
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 2 — BOOK
            ══════════════════════════════════════════════════════════ */}
        {activeTab === 2 && (
          <>
            <View style={styles.bookHeader}>
              <View>
                <Text style={styles.sectionTitle}>Income & Expenses Book</Text>
                <Text style={styles.sectionSubtitle}>
                  {ledgerData.transactions.length} transactions
                </Text>
              </View>
              <View style={styles.ledgerToggle}>
                <Pressable
                  style={[styles.toggleBtn, ledgerView === 'TABLE' && styles.toggleBtnActive]}
                  onPress={() => setLedgerView('TABLE')}
                >
                  <Table2 color={ledgerView === 'TABLE' ? '#fff' : COLORS.textSecondary} size={15} />
                </Pressable>
                <Pressable
                  style={[styles.toggleBtn, ledgerView === 'CARDS' && styles.toggleBtnActive]}
                  onPress={() => setLedgerView('CARDS')}
                >
                  <ListIcon color={ledgerView === 'CARDS' ? '#fff' : COLORS.textSecondary} size={15} />
                </Pressable>
              </View>
            </View>
            <View style={styles.ledgerContainer}>
              {ledgerView === 'TABLE'
                ? <LedgerTable transactions={ledgerData.transactions} summary={ledgerData.summary} />
                : <LedgerList  transactions={ledgerData.transactions} summary={ledgerData.summary} />}
            </View>
          </>
        )}

      </ScrollView>

      {/* ── Date Range Picker Bottom Sheet ─────────────────────────── */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.datePickerSheet}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Select Date Range</Text>
                  <Pressable style={styles.sheetCloseBtn} onPress={() => setPickerVisible(false)}>
                    <X color={COLORS.textSecondary} size={16} />
                  </Pressable>
                </View>

                <View style={styles.dateTabs}>
                  <Pressable
                    style={[styles.dateTab, pickerTab === 'FROM' && styles.dateTabActive]}
                    onPress={() => setPickerTab('FROM')}
                  >
                    <Text style={[styles.dateTabLabel, pickerTab === 'FROM' && styles.dateTabLabelActive]}>From</Text>
                    <Text style={[styles.dateTabValue, pickerTab === 'FROM' && styles.dateTabValueActive]}>
                      {fmtDate(customStart)}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dateTab, pickerTab === 'TO' && styles.dateTabActive]}
                    onPress={() => setPickerTab('TO')}
                  >
                    <Text style={[styles.dateTabLabel, pickerTab === 'TO' && styles.dateTabLabelActive]}>To</Text>
                    <Text style={[styles.dateTabValue, pickerTab === 'TO' && styles.dateTabValueActive]}>
                      {fmtDate(customEnd)}
                    </Text>
                  </Pressable>
                </View>

                {pickerTab === 'FROM' ? (
                  <MiniCalendar selectedDate={customStart} onSelectDate={(d) => { setCustomStart(d); if (d > customEnd) setCustomEnd(d); setPickerTab('TO'); }} />
                ) : (
                  <MiniCalendar selectedDate={customEnd}   onSelectDate={setCustomEnd} />
                )}

                <Pressable
                  style={[styles.applyBtn, customStart > customEnd && styles.applyBtnDisabled]}
                  onPress={applyRange}
                  disabled={customStart > customEnd}
                >
                  <Text style={styles.applyBtnText}>Apply Date Range</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

export default Reports;
