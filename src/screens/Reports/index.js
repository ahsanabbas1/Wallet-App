import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable,
  ActivityIndicator, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import {
  BarChart3, PieChart as PieIcon, ArrowUp, ArrowDown,
  Info, Menu, TrendingUp, Table2, List as ListIcon,
  DollarSign, TrendingDown, Activity
} from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import {
  getReportInsights, getCashFlowData,
  getLedgerData, getChartData
} from '../../services/reportInsightsService';
import { dashboardService } from '../../services/dashboardService';
import CashFlowTable from '../../components/CashFlowTable';
import LedgerTable from '../../components/LedgerTable';
import LedgerList from '../../components/LedgerList';
import LineChart from '../../components/Charts/LineChart';
import IncomeExpenseBarChart from '../../components/Charts/IncomeExpenseBarChart';
import SavingsAreaChart from '../../components/Charts/SavingsAreaChart';
import { styles } from './styles';

const { width } = Dimensions.get('window');

const FILTERS = [
  { label: 'Weekly', value: 'WEEK' },
  { label: 'Monthly', value: 'MONTH' },
  { label: 'Yearly', value: 'YEAR' },
];

const Reports = () => {
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState('MONTH');
  const [ledgerView, setLedgerView] = useState('TABLE');

  const [reportData, setReportData] = useState({
    currentSpend: 0, prevSpend: 0,
    trendPercent: 0, isTrendUp: false,
    breakdown: [], monthlyTrend: []
  });
  const [insights, setInsights] = useState({
    overspending: [], recommendations: [], insights: []
  });
  const [cashFlow, setCashFlow] = useState([]);
  const [ledger, setLedger] = useState({ transactions: [], summary: {} });
  const [charts, setCharts] = useState({
    trendLine: [], incomeExpenseBar: [],
    incomeBreakdown: [], savingsArea: []
  });

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const uid = userId;

      // Parallel fetches
      const [insightsData, cashFlowData, ledgerData, chartData, transactions] = await Promise.all([
        getReportInsights(uid, filterPeriod),
        getCashFlowData(uid, filterPeriod),
        getLedgerData(uid, filterPeriod),
        getChartData(uid, filterPeriod),
        dashboardService.getReportData(uid, filterPeriod),
      ]);

      setInsights(insightsData);
      setCashFlow(cashFlowData);
      setLedger(ledgerData);
      setCharts(chartData);

      // Expense breakdown
      const currentSpend = transactions.reduce((s, t) => s + parseFloat(t.amount), 0);

      const now = new Date();
      let prevStart = new Date(now), prevEnd = new Date(now);
      if (filterPeriod === 'WEEK') {
        prevStart.setDate(now.getDate() - 14);
        prevEnd.setDate(now.getDate() - 7);
      } else if (filterPeriod === 'MONTH') {
        prevStart.setMonth(now.getMonth() - 2);
        prevEnd.setMonth(now.getMonth());
      } else {
        prevStart.setFullYear(now.getFullYear() - 2);
        prevEnd.setFullYear(now.getFullYear() - 1);
      }

      const { data: prevTrans } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', uid).eq('type', 'expense')
        .gte('date', prevStart.toISOString())
        .lte('date', prevEnd.toISOString());

      const prevSpend = (prevTrans || []).reduce((s, t) => s + parseFloat(t.amount), 0);
      const trendPercent = prevSpend > 0
        ? Math.abs(((currentSpend - prevSpend) / prevSpend) * 100) : 0;

      const prevCatMap = {};
      (prevTrans || []).forEach(t => {
        const n = t.categories?.name || 'Other';
        prevCatMap[n] = (prevCatMap[n] || 0) + parseFloat(t.amount);
      });

      const catMap = {};
      transactions.forEach(t => {
        const n = t.categories?.name || 'Other';
        catMap[n] = (catMap[n] || 0) + parseFloat(t.amount);
      });

      const breakdown = Object.keys(catMap).map(name => {
        const curr = catMap[name], prev = prevCatMap[name] || 0;
        const variance = curr - prev;
        return {
          label: name,
          amount: curr,
          percent: currentSpend > 0 ? (curr / currentSpend) * 100 : 0,
          color: transactions.find(t => (t.categories?.name || 'Other') === name)?.categories?.color || COLORS.primary,
          variancePercent: prev > 0 ? (variance / prev) * 100 : (curr > 0 ? 100 : 0),
          isUp: variance > 0
        };
      }).sort((a, b) => b.amount - a.amount);

      // 6-month bar trend
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const { data: mt } = await supabase
          .from('transactions').select('amount')
          .eq('user_id', uid).eq('type', 'expense')
          .gte('date', new Date(d.getFullYear(), d.getMonth(), 1).toISOString())
          .lt('date', new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString());
        monthlyTrend.push({ label: months[d.getMonth()], amount: (mt||[]).reduce((s,t)=>s+parseFloat(t.amount),0), height: 0 });
      }
      const maxM = Math.max(...monthlyTrend.map(m => m.amount), 1);
      monthlyTrend.forEach(m => { m.height = (m.amount / maxM) * 100; });

      setReportData({ currentSpend, prevSpend, trendPercent, isTrendUp: currentSpend > prevSpend, breakdown, monthlyTrend });
    } catch (err) {
      console.error('Reports fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [filterPeriod, userId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }}>
          <Pressable
            style={({ pressed }) => ({ marginRight: 16, padding: 8, backgroundColor: COLORS.card, borderRadius: 12, opacity: pressed ? 0.7 : 1 })}
            onPress={openDrawer}
          >
            <Menu color={COLORS.text} size={24} />
          </Pressable>
          <Text style={[styles.headerTitle, { marginBottom: 0 }]}>Financial Reports</Text>
        </View>

        {/* ── Period Filters ── */}
        <View style={styles.filterContainer}>
          {FILTERS.map(f => (
            <Pressable
              key={f.value}
              style={[styles.filterButton, filterPeriod === f.value && styles.filterButtonActive]}
              onPress={() => setFilterPeriod(f.value)}
            >
              <Text style={[styles.filterButtonText, filterPeriod === f.value && styles.filterButtonTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Summary Card ── */}
        <View style={styles.summaryCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={styles.summaryLabel}>Spent this period</Text>
              <Text style={styles.summaryAmount}>
                PKR {reportData.currentSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={[styles.trendBadge, { backgroundColor: reportData.isTrendUp ? 'rgba(244,67,54,0.1)' : 'rgba(76,175,80,0.1)' }]}>
              {reportData.isTrendUp
                ? <ArrowUp color={COLORS.error} size={14} />
                : <ArrowDown color="#4caf50" size={14} />}
              <Text style={[styles.trendText, { color: reportData.isTrendUp ? COLORS.error : '#4caf50' }]}>
                {reportData.trendPercent.toFixed(1)}%
              </Text>
            </View>
          </View>
          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
            <Text style={styles.comparisonText}>
              Previous period: <Text style={{ color: COLORS.text }}>PKR {reportData.prevSpend.toLocaleString()}</Text>
            </Text>
          </View>
        </View>

        {/* ── Spending Breakdown ── */}
        <SectionHeader title="Spending Breakdown" icon={<PieIcon color={COLORS.textSecondary} size={20} />} />
        <View style={styles.breakdownContainer}>
          {reportData.breakdown.length > 0
            ? reportData.breakdown.map((item, i) => (
                <BreakdownItem key={i} {...item} />
              ))
            : <EmptyText text="No expense data for this period." />}
        </View>

        {/* ── 6-Month Bar Trend ── */}
        <SectionHeader title="6-Month Expense Trend" icon={<BarChart3 color={COLORS.textSecondary} size={20} />} />
        <View style={styles.chartContainer}>
          <View style={styles.barChart}>
            {reportData.monthlyTrend.map((item, i) => (
              <ChartBar key={i} label={item.label} height={item.height} active={i === reportData.monthlyTrend.length - 1} />
            ))}
          </View>
        </View>

        {/* ── Spending Trend Line ── */}
        <SectionHeader title="Spending Trend" icon={<TrendingDown color={COLORS.textSecondary} size={20} />} />
        <View style={styles.chartContainer}>
          <LineChart data={charts.trendLine.map(d => ({ label: d.month, amount: d.amount }))} color={COLORS.primary} height={200} />
        </View>

        {/* ── Income vs Expense Bar Chart ── */}
        <SectionHeader title="Income vs Expenses" icon={<Activity color={COLORS.textSecondary} size={20} />} />
        <View style={styles.chartContainer}>
          <IncomeExpenseBarChart data={charts.incomeExpenseBar} height={220} />
        </View>

        {/* ── Income Breakdown ── */}
        {charts.incomeBreakdown.length > 0 && (
          <>
            <SectionHeader title="Income Sources" icon={<DollarSign color={COLORS.textSecondary} size={20} />} />
            <View style={styles.breakdownContainer}>
              {charts.incomeBreakdown.map((item, i) => (
                <View key={i} style={styles.breakdownItem}>
                  <View style={styles.breakdownHeader}>
                    <View style={styles.labelGroup}>
                      <View style={[styles.dot, { backgroundColor: item.color }]} />
                      <Text style={styles.breakdownLabel}>{item.name}</Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginLeft: 6 }}>{item.percent}%</Text>
                    </View>
                    <Text style={[styles.breakdownAmount, { color: '#0bda73' }]}>
                      PKR {item.amount.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressIndicator, { width: `${Math.max(parseFloat(item.percent), 2)}%`, backgroundColor: item.color }]} />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Cumulative Savings Area ── */}
        <SectionHeader title="Cumulative Savings" icon={<TrendingUp color={COLORS.textSecondary} size={20} />} />
        <View style={styles.chartContainer}>
          <SavingsAreaChart data={charts.savingsArea} height={220} />
        </View>

        {/* ── Smart Insights ── */}
        <View style={styles.insightsCard}>
          <View style={styles.insightsIcon}>
            <TrendingUp color={COLORS.primary} size={20} />
          </View>
          <View style={styles.insightsTextContainer}>
            <Text style={styles.insightsTitle}>Smart Insights</Text>
            <View style={styles.expandedInsights}>
              {insights.insights.length > 0
                ? insights.insights.map((t, i) => <Text key={i} style={styles.insightItem}>{t}</Text>)
                : <Text style={styles.insightItem}>Track more transactions to unlock personalized insights.</Text>}
            </View>
          </View>
        </View>

        {/* ── Recommendations ── */}
        {insights.recommendations.length > 0 && (
          <>
            <SectionHeader title="Ways to Reduce Spending" icon={<Info color={COLORS.textSecondary} size={20} />} />
            <View style={styles.recommendationsSection}>
              {insights.recommendations.map((rec, i) => (
                <View key={i} style={[styles.recommendationCard, { borderLeftColor: COLORS.primary }]}>
                  <Text style={styles.recommendationTitle}>📉 {rec.category}</Text>
                  <Text style={styles.recommendationText}>{rec.message}</Text>
                  <Text style={styles.savingsAmount}>
                    Potential savings: PKR {rec.savingsPotential.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Overspending Alerts ── */}
        {insights.overspending.length > 0 && (
          <>
            <SectionHeader title="Overspending Alerts" icon={<Info color={COLORS.error} size={20} />} />
            <View style={styles.recommendationsSection}>
              {insights.overspending.map((a, i) => (
                <View key={i} style={[styles.recommendationCard, { borderLeftColor: COLORS.error }]}>
                  <Text style={styles.recommendationTitle}>⚠️ {a.category}</Text>
                  <Text style={styles.recommendationText}>{a.reason}</Text>
                  <Text style={{ color: COLORS.error, fontSize: 13, fontWeight: '600' }}>
                    Current: PKR {a.current.toLocaleString(undefined, { maximumFractionDigits: 0 })} | Limit: PKR {a.limit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Cash Flow Table ── */}
        <SectionHeader title="Cash Flow" icon={<BarChart3 color={COLORS.textSecondary} size={20} />} />
        <CashFlowTable data={cashFlow} />

        {/* ── Income & Expenses Book ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>Income & Expenses Book</Text>
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

        {ledgerView === 'TABLE'
          ? <LedgerTable transactions={ledger.transactions} summary={ledger.summary} />
          : <LedgerList transactions={ledger.transactions} summary={ledger.summary} />}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

/* ─── Sub-components ─── */

const SectionHeader = ({ title, icon }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {icon}
  </View>
);

const EmptyText = ({ text }) => (
  <Text style={{ color: COLORS.textSecondary, textAlign: 'center', padding: 20 }}>{text}</Text>
);

const BreakdownItem = ({ label, percent, amount, color, variancePercent, isUp }) => (
  <View style={styles.breakdownItem}>
    <View style={styles.breakdownHeader}>
      <View style={styles.labelGroup}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.breakdownLabel}>{label}</Text>
        {Math.abs(variancePercent) > 0.5 && (
          <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center' }}>
            {isUp ? <ArrowUp color={COLORS.error} size={12} /> : <ArrowDown color="#4caf50" size={12} />}
            <Text style={{ color: isUp ? COLORS.error : '#4caf50', fontSize: 11, marginLeft: 2 }}>
              {Math.abs(variancePercent).toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.breakdownAmount}>PKR {amount.toLocaleString()}</Text>
    </View>
    <View style={styles.progressBar}>
      <View style={[styles.progressIndicator, { width: `${Math.max(percent, 2)}%`, backgroundColor: color }]} />
    </View>
  </View>
);

const ChartBar = ({ label, height, active }) => (
  <View style={styles.barContainer}>
    <View style={[styles.bar, { height: `${Math.max(height, 5)}%` }, active && styles.activeBar]} />
    <Text style={[styles.barLabel, active && styles.activeBarLabel]}>{label}</Text>
  </View>
);

export default Reports;
