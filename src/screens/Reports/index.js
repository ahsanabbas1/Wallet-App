import React, { useState, useCallback, useMemo, useEffect } from 'react'; // useMemo used for styles, fmt, and derived data
import {
  View, Text, ScrollView, Pressable, Modal, Alert,
  ActivityIndicator, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Menu, CalendarDays, X, Download, FileSpreadsheet, FileText,
  TrendingUp, TrendingDown, ArrowUp, ArrowDown,
  AlertTriangle, Lightbulb, BarChart3,
  Table2, List as ListIcon, Activity, Info,
} from 'lucide-react-native';
import HeaderMenu from '../../components/HeaderMenu';
import { exportToExcel, exportToPDF } from '../../services/reportExportService';
import { useDrawer }       from '../../context/DrawerContext';
import { useAuth }         from '../../context/AuthContext';
import { useProfile }      from '../../context/ProfileContext';
import { useTheme }        from '../../context/ThemeContext';
import { useReportsFilter } from '../../context/ReportsFilterContext';
import { getDb }           from '../../lib/db';
import { transactionService } from '../../services/transactionService';
import { useFocusEffect }  from '@react-navigation/native';

import MiniCalendar            from '../../components/Calendar';
import CashFlowTable           from '../../components/CashFlowTable';
import LedgerTable             from '../../components/LedgerTable';
import LedgerList              from '../../components/LedgerList';
import LineChart               from '../../components/Charts/LineChart';
import IncomeExpenseBarChart   from '../../components/Charts/IncomeExpenseBarChart';
import SavingsAreaChart        from '../../components/Charts/SavingsAreaChart';

import { makeStyles } from './styles';

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

/* ─── single unified SQLite fetch ───────────────────────────────────────── */

const fetchAllReportData = async (userId, period, customDates) => {
  const db = getDb();
  const { start, end } = buildDateRange(period, customDates);
  const { start: pStart, end: pEnd } = buildPrevRange(period, start);

  // Build category map once — used to attach category objects to transactions
  const cats   = await transactionService.getCategories(userId);
  const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
  const attach = (rows) => rows.map(t => ({ ...t, categories: catMap[t.category_id] || null }));

  // Current + previous + 6 monthly buckets — all in parallel
  const [curRows, prevRows, ...monthRows] = await Promise.all([
    db.getAllAsync(
      'SELECT * FROM transactions WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC',
      [userId, start.toISOString(), end.toISOString()]
    ),
    db.getAllAsync(
      'SELECT * FROM transactions WHERE user_id = ? AND date >= ? AND date <= ?',
      [userId, pStart.toISOString(), pEnd.toISOString()]
    ),
    ...Array.from({ length: 6 }, (_, i) => {
      const now  = new Date();
      const d    = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const mS   = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      const mE   = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
      return db.getAllAsync(
        'SELECT amount, type, is_loan FROM transactions WHERE user_id = ? AND date >= ? AND date < ?',
        [userId, mS, mE]
      );
    }),
  ]);

  const current  = attach(curRows);
  const previous = attach(prevRows);

  const sixMonthBars = monthRows.map((rows, i) => {
    const now     = new Date();
    const d       = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const nonLoan = rows.filter(t => t.is_loan !== 1);
    return {
      label:   MONTH_NAMES[d.getMonth()],
      expense: nonLoan.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0),
      income:  nonLoan.filter(t => t.type === 'income') .reduce((s, t) => s + parseFloat(t.amount), 0),
    };
  });

  return { current, previous, sixMonthBars, rangeStart: start, rangeEnd: end };
};

/* ─── derived data builders (memoised in component) ─────────────────────── */

const deriveMetrics = (current, previous) => {
  const cur  = current .filter(t => t.is_loan !== 1);
  const prev = previous.filter(t => t.is_loan !== 1);

  const income  = cur.filter(t => t.type === 'income') .reduce((s, t) => s + parseFloat(t.amount), 0);
  const expense = cur.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const net     = income - expense;

  const prevExpense = prev.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const prevIncome  = prev.filter(t => t.type === 'income') .reduce((s, t) => s + parseFloat(t.amount), 0);

  const expenseChange = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0;
  const incomeChange  = prevIncome  > 0 ? ((income  - prevIncome)  / prevIncome)  * 100 : 0;

  return { income, expense, net, prevExpense, prevIncome, expenseChange, incomeChange };
};

const deriveBreakdown = (current, totalExpense, fallbackColor) => {
  const map = {};
  current.filter(t => t.is_loan !== 1 && t.type === 'expense').forEach(t => {
    const n = t.categories?.name || 'Other';
    if (!map[n]) map[n] = { amount: 0, color: t.categories?.color || fallbackColor };
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
  previous.filter(t => t.is_loan !== 1 && t.type === 'expense').forEach(t => {
    const n = t.categories?.name || 'Other';
    prevMap[n] = (prevMap[n] || 0) + parseFloat(t.amount);
  });
  const currMap = {};
  current.filter(t => t.is_loan !== 1 && t.type === 'expense').forEach(t => {
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

const deriveChartData = (current, sixMonthBars, fallbackColor) => {
  const nonLoanCurrent = current.filter(t => t.is_loan !== 1);
  // Monthly grouped data for line + bar charts
  const monthMap = {};
  nonLoanCurrent.forEach(t => {
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
  nonLoanCurrent.filter(t => t.type === 'income').forEach(t => {
    const n = t.categories?.name || 'Other';
    if (!incomeMap[n]) incomeMap[n] = { amount: 0, color: t.categories?.color || fallbackColor };
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
  current.filter(t => t.is_loan !== 1).forEach(t => {
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

const deriveLedger = (current, loanColor, fallbackColor) => {
  const nonTransfer = current.filter(t => t.type !== 'transfer');
  let balance = 0;
  const txs = [...nonTransfer].sort((a, b) => new Date(a.date) - new Date(b.date)).map(t => {
    const a = parseFloat(t.amount);
    balance += t.type === 'income' ? a : -a;
    return {
      id:             t.id,
      date:           new Date(t.date).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' }),
      dateISO:        t.date,
      description:    t.title || '—',
      category:       t.is_loan ? 'Loan' : (t.categories?.name || 'Other'),
      categoryColor:  t.is_loan ? loanColor : (t.categories?.color || fallbackColor),
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
  const { colors: COLORS }   = useTheme();
  const styles               = useMemo(() => makeStyles(COLORS), [COLORS]);
  const fmt                  = useMemo(() => fmtAmt(currency), [currency]);

  /* ── period / date state (persisted across navigation) ─────────────── */
  const {
    filterPeriod,   setFilterPeriod,
    appliedStart,   setAppliedStart,
    appliedEnd,     setAppliedEnd,
    isCustomActive, setIsCustomActive,
    activeTab,      setActiveTab,
    ledgerView,     setLedgerView,
  } = useReportsFilter();
  const [customStart, setCustomStart] = useState(today());
  const [customEnd,   setCustomEnd]   = useState(today());

  /* ── modal ────────────────────────────────────────────────────────── */
  const [pickerVisible,     setPickerVisible]     = useState(false);
  const [pickerTab,         setPickerTab]         = useState('FROM');
  const [exportMenuVisible, setExportMenuVisible] = useState(false);
  const [exporting,         setExporting]         = useState(false);

  /* ── UI ───────────────────────────────────────────────────────────── */
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState(false);

  /* ── raw data (single fetch) ─────────────────────────────────────── */
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


  /* ── memoised derived data ───────────────────────────────────────── */
  const metrics        = useMemo(() => deriveMetrics(rawData.current, rawData.previous),                      [rawData]);
  const breakdown      = useMemo(() => deriveBreakdown(rawData.current, metrics.expense, COLORS.primary),      [rawData, metrics.expense, COLORS.primary]);
  const catVariance    = useMemo(() => deriveCategoryVariance(rawData.current, rawData.previous),             [rawData]);
  const insights       = useMemo(() => deriveInsights(metrics, breakdown, catVariance, fmt),                  [metrics, breakdown, catVariance, fmt]);
  const chartData      = useMemo(() => deriveChartData(rawData.current, rawData.sixMonthBars, COLORS.primary), [rawData, COLORS.primary]);
  const cashFlowData   = useMemo(() => deriveCashFlow(rawData.current),                              [rawData]);
  const ledgerData     = useMemo(() => deriveLedger(rawData.current, COLORS.warning, COLORS.primary),         [rawData, COLORS.warning, COLORS.primary]);

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

  const handleExport = async (type) => {
    setExportMenuVisible(false);
    setExporting(true);
    try {
      if (type === 'excel') {
        await exportToExcel(rawData.current, metrics, breakdown, currency, periodLabel);
      } else {
        await exportToPDF(rawData.current, metrics, breakdown, currency, periodLabel);
      }
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setExporting(false);
    }
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
          <Text style={{ color: COLORS.onGradient, fontWeight: 'bold', fontSize: 15 }}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const showPageInfo = () => Alert.alert('About This Page', 'View charts and summaries of your income vs expenses over time. Filter by month or category.');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.7 }]} onPress={openDrawer}>
            <Menu color={COLORS.text} size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Reports</Text>
          <Pressable
            style={[styles.calendarBtn, exporting && { opacity: 0.5 }]}
            onPress={() => setExportMenuVisible(true)}
            disabled={exporting}
          >
            <Download color={COLORS.textSecondary} size={18} />
          </Pressable>
          <Pressable style={[styles.calendarBtn, isCustomActive && styles.calendarBtnActive]} onPress={openPicker}>
            <CalendarDays color={isCustomActive ? COLORS.onGradient : COLORS.textSecondary} size={18} />
          </Pressable>
          <HeaderMenu items={[
            { icon: Info, label: 'About This Page', onPress: showPageInfo },
          ]} />
        </View>

        {/* ── Export menu modal ───────────────────────────────────── */}
        <Modal visible={exportMenuVisible} transparent animationType="fade" onRequestClose={() => setExportMenuVisible(false)}>
          <Pressable style={{ flex: 1, backgroundColor: COLORS.overlay }} onPress={() => setExportMenuVisible(false)}>
            <View style={{
              position: 'absolute', top: 60, right: 16,
              backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden',
              borderWidth: 1, borderColor: COLORS.border,
              shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
              minWidth: 200,
            }}>
              <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Export · {periodLabel}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: pressed ? COLORS.surface : 'transparent' }]}
                onPress={() => handleExport('excel')}
              >
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.success + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <FileSpreadsheet color={COLORS.success} size={18} />
                </View>
                <View>
                  <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 14 }}>Export as Excel</Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>Summary, Transactions, Categories</Text>
                </View>
              </Pressable>
              <Pressable
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: pressed ? COLORS.surface : 'transparent' }]}
                onPress={() => handleExport('pdf')}
              >
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.error + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText color={COLORS.error} size={18} />
                </View>
                <View>
                  <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 14 }}>Export as PDF</Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>Formatted report with charts</Text>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

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
              backgroundColor: metrics.expenseChange > 0 ? COLORS.error + '33' : COLORS.success + '33',
            }]}>
              {metrics.expenseChange > 0
                ? <ArrowUp   color={COLORS.error} size={12} />
                : <ArrowDown color={COLORS.success} size={12} />}
              <Text style={[styles.heroTrendText, { color: metrics.expenseChange > 0 ? COLORS.error : COLORS.success }]}>
                {Math.abs(metrics.expenseChange).toFixed(1)}%
              </Text>
            </View>
            <Text style={styles.heroTrendLabel}>vs previous period</Text>
          </View>

          {/* Income / Net / Expense row */}
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Income</Text>
              <Text style={[styles.heroStatValue, { color: COLORS.success }]}>{fmt(metrics.income)}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Net</Text>
              <Text style={[styles.heroStatValue, { color: metrics.net >= 0 ? COLORS.success : COLORS.error }]}>
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
                        backgroundColor: isLast ? COLORS.primary : COLORS.primary + '40',
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
                <Text style={[styles.kpiValue, { color: metrics.net >= 0 ? COLORS.success : COLORS.error }]}>
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
                              ? <ArrowUp color={COLORS.error} size={11} />
                              : <ArrowDown color={COLORS.success} size={11} />}
                            <Text style={[styles.catVarianceText, { color: variance > 0 ? COLORS.error : COLORS.success }]}>
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
                      <View key={i} style={[styles.alertCard, { backgroundColor: COLORS.error + '14', borderLeftWidth: 3, borderLeftColor: COLORS.error }]}>
                        <View style={[styles.alertIconWrap, { backgroundColor: COLORS.error + '26' }]}>
                          <AlertTriangle color={COLORS.error} size={16} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.alertTitle}>{cat}</Text>
                          <Text style={styles.alertBody}>
                            {pct.toFixed(0)}% higher than previous period
                          </Text>
                          {catData && (
                            <Text style={[styles.alertValue, { color: COLORS.error }]}>
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
        {activeTab === 1 && (() => {
          const savingsRate = metrics.income > 0 ? ((metrics.net / metrics.income) * 100) : 0;
          const totalFlow   = metrics.income + metrics.expense;
          const incRatio    = totalFlow > 0 ? (metrics.income / totalFlow) * 100 : 50;

          return (
            <>
              {/* ── 1. Summary Card ──────────────────────────────── */}
              <View style={[styles.chartCard, { padding: 0, overflow: 'hidden' }]}>

                {/* Top: Income + Expense side by side */}
                <View style={{ flexDirection: 'row' }}>
                  {/* Income */}
                  <View style={{ flex: 1, padding: 18, paddingBottom: 14, borderRightWidth: 1, borderRightColor: COLORS.divider }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 }}>Income</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: metrics.incomeChange >= 0 ? COLORS.success + '18' : COLORS.error + '18', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 }}>
                        {metrics.incomeChange >= 0
                          ? <ArrowUp   color={COLORS.success} size={10} />
                          : <ArrowDown color={COLORS.error} size={10} />}
                        <Text style={{ color: metrics.incomeChange >= 0 ? COLORS.success : COLORS.error, fontSize: 10, fontWeight: '700' }}>
                          {Math.abs(metrics.incomeChange).toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: COLORS.success, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>{fmt(metrics.income)}</Text>
                    <Text style={{ color: COLORS.textTertiary, fontSize: 10, marginTop: 4 }}>vs prev period</Text>
                  </View>

                  {/* Expense */}
                  <View style={{ flex: 1, padding: 18, paddingBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 }}>Expense</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: metrics.expenseChange <= 0 ? COLORS.success + '18' : COLORS.error + '18', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 }}>
                        {metrics.expenseChange <= 0
                          ? <ArrowDown color={COLORS.success} size={10} />
                          : <ArrowUp   color={COLORS.error} size={10} />}
                        <Text style={{ color: metrics.expenseChange <= 0 ? COLORS.success : COLORS.error, fontSize: 10, fontWeight: '700' }}>
                          {Math.abs(metrics.expenseChange).toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: COLORS.error, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>{fmt(metrics.expense)}</Text>
                    <Text style={{ color: COLORS.textTertiary, fontSize: 10, marginTop: 4 }}>vs prev period</Text>
                  </View>
                </View>

                {/* Income/Expense ratio bar */}
                <View style={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 6 }}>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: COLORS.divider, flexDirection: 'row', overflow: 'hidden' }}>
                    <View style={{ width: `${incRatio}%`, backgroundColor: COLORS.success }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
                    <Text style={{ color: COLORS.success, fontSize: 10, fontWeight: '600' }}>Income {incRatio.toFixed(0)}%</Text>
                    <Text style={{ color: COLORS.error, fontSize: 10, fontWeight: '600' }}>Expense {(100 - incRatio).toFixed(0)}%</Text>
                  </View>
                </View>

                {/* Bottom: Net + Savings Rate */}
                <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.divider }}>
                  <View style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderRightWidth: 1, borderRightColor: COLORS.divider }}>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Net Balance</Text>
                    <Text style={{ color: metrics.net >= 0 ? COLORS.success : COLORS.error, fontSize: 17, fontWeight: '800' }}>
                      {metrics.net >= 0 ? '+' : ''}{fmt(metrics.net)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', paddingVertical: 14 }}>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Savings Rate</Text>
                    <Text style={{ color: savingsRate >= 0 ? COLORS.success : COLORS.error, fontSize: 17, fontWeight: '800' }}>
                      {savingsRate.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>

              {/* ── 2. Monthly Income vs Expenses ────────────────── */}
              <View style={styles.chartCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <View>
                    <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700' }}>Monthly Overview</Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>Income vs Expenses per month</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success }} />
                      <Text style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: '600' }}>Income</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.error }} />
                      <Text style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: '600' }}>Expense</Text>
                    </View>
                  </View>
                </View>
                <IncomeExpenseBarChart data={chartData.incomeExpBar} height={200} />
              </View>

              {/* ── 3. Expense Trend ─────────────────────────────── */}
              <View style={styles.chartCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <View>
                    <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700' }}>Spending Trend</Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>How your expenses move over time</Text>
                  </View>
                  <View style={{ backgroundColor: COLORS.primary + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                    <Text style={{ color: COLORS.primary, fontSize: 10, fontWeight: '700' }}>MONTHLY</Text>
                  </View>
                </View>
                <LineChart data={chartData.trendLine} color={COLORS.primary} height={180} />
              </View>

              {/* ── 4. Top Expense Categories ────────────────────── */}
              {breakdown.length > 0 && (
                <View style={styles.chartCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <View>
                      <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700' }}>Top Categories</Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>Where your money goes</Text>
                    </View>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>{breakdown.length} active</Text>
                  </View>

                  {breakdown.slice(0, 6).map((item, i) => {
                    const variance = catVariance[item.label] || 0;
                    return (
                      <View key={i} style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                          {/* Left: color dot + name + variance */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
                            <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>{item.label}</Text>
                            {Math.abs(variance) > 1 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                {variance > 0 ? <ArrowUp color={COLORS.error} size={10} /> : <ArrowDown color={COLORS.success} size={10} />}
                                <Text style={{ color: variance > 0 ? COLORS.error : COLORS.success, fontSize: 10, fontWeight: '700' }}>
                                  {Math.abs(variance).toFixed(0)}%
                                </Text>
                              </View>
                            )}
                          </View>
                          {/* Right: amount + percent */}
                          <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                            <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700' }}>{fmt(item.amount)}</Text>
                            <Text style={{ color: COLORS.textSecondary, fontSize: 10, marginTop: 1 }}>{item.percent.toFixed(1)}%</Text>
                          </View>
                        </View>
                        {/* Progress bar */}
                        <View style={{ height: 5, backgroundColor: COLORS.divider, borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ height: '100%', width: `${Math.max(item.percent, 1)}%`, backgroundColor: item.color, borderRadius: 3 }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* ── 5. Savings Trajectory ────────────────────────── */}
              <View style={styles.chartCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <View>
                    <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700' }}>Savings Growth</Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>Cumulative net balance over time</Text>
                  </View>
                  <View style={{ backgroundColor: metrics.net >= 0 ? COLORS.success + '18' : COLORS.error + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                    <Text style={{ color: metrics.net >= 0 ? COLORS.success : COLORS.error, fontSize: 10, fontWeight: '700' }}>
                      {metrics.net >= 0 ? 'GROWING' : 'DECLINING'}
                    </Text>
                  </View>
                </View>
                <SavingsAreaChart data={chartData.savingsArea} height={180} />
              </View>

              {/* ── 6. Income Sources ────────────────────────────── */}
              {chartData.incomeBreakdown.length > 0 && (
                <View style={styles.chartCard}>
                  <View style={{ marginBottom: 18 }}>
                    <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700' }}>Income Sources</Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>Where your income comes from</Text>
                  </View>
                  {chartData.incomeBreakdown.map((item, i) => (
                    <View key={i} style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
                          <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>{item.name}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                          <Text style={{ color: COLORS.success, fontSize: 13, fontWeight: '700' }}>{fmt(item.amount)}</Text>
                          <Text style={{ color: COLORS.textSecondary, fontSize: 10, marginTop: 1 }}>{item.percent}%</Text>
                        </View>
                      </View>
                      <View style={{ height: 5, backgroundColor: COLORS.divider, borderRadius: 3, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${Math.max(parseFloat(item.percent), 1)}%`, backgroundColor: item.color, borderRadius: 3 }} />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* ── 7. Cash Flow Table ───────────────────────────── */}
              <View style={[styles.sectionHeader, { marginTop: 4 }]}>
                <View>
                  <Text style={styles.sectionTitle}>Cash Flow</Text>
                  <Text style={styles.sectionSubtitle}>Tap a month to expand daily view</Text>
                </View>
                <BarChart3 color={COLORS.textSecondary} size={18} />
              </View>
              <View style={{ marginBottom: 8 }}>
                <CashFlowTable data={cashFlowData} />
              </View>
            </>
          );
        })()}

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
                  <Table2 color={ledgerView === 'TABLE' ? COLORS.onGradient : COLORS.textSecondary} size={15} />
                </Pressable>
                <Pressable
                  style={[styles.toggleBtn, ledgerView === 'CARDS' && styles.toggleBtnActive]}
                  onPress={() => setLedgerView('CARDS')}
                >
                  <ListIcon color={ledgerView === 'CARDS' ? COLORS.onGradient : COLORS.textSecondary} size={15} />
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
