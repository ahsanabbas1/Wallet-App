import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';
import { BarChart3, PieChart as PieIcon, ArrowUp, ArrowDown, Info, Menu, TrendingUp } from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { getReportInsights } from '../../services/reportInsightsService';
import { dashboardService } from '../../services/dashboardService';
import { styles } from './styles';

const { width } = Dimensions.get('window');

const Reports = () => {
  const { openDrawer } = useDrawer();
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState('MONTH');
  const [reportData, setReportData] = useState({
    currentMonthSpend: 0,
    lastMonthSpend: 0,
    trendPercent: 0,
    isTrendUp: false,
    breakdown: [],
    monthlyTrend: []
  });
  const [insights, setInsights] = useState({
    currentSpend: 0,
    previousSpend: 0,
    overspending: [],
    recommendations: [],
    patterns: {},
    insights: [],
    transactionCount: 0
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Fetch insights
      const insightsData = await getReportInsights(session.user.id, filterPeriod);
      setInsights(insightsData);

      // Fetch report data based on period
      const transactions = await dashboardService.getReportData(session.user.id, filterPeriod);

      // Calculate report metrics
      const currentSpend = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

      // Get previous period transactions for comparison
      const now = new Date();
      let prevStartDate = new Date(now);
      let prevEndDate = new Date(now);

      if (filterPeriod === 'WEEK') {
        prevStartDate.setDate(now.getDate() - 14);
        prevEndDate.setDate(now.getDate() - 7);
      } else if (filterPeriod === 'MONTH') {
        prevStartDate.setMonth(now.getMonth() - 2);
        prevEndDate.setMonth(now.getMonth());
      } else if (filterPeriod === 'YEAR') {
        prevStartDate.setFullYear(now.getFullYear() - 2);
        prevEndDate.setFullYear(now.getFullYear() - 1);
      }

      const { data: prevTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('type', 'expense')
        .gte('date', prevStartDate.toISOString())
        .lte('date', prevEndDate.toISOString());

      const prevSpend = (prevTransactions || []).reduce((sum, t) => sum + parseFloat(t.amount), 0);

      let trendPercent = 0;
      if (prevSpend > 0) {
        trendPercent = ((currentSpend - prevSpend) / prevSpend) * 100;
      }
      const isTrendUp = currentSpend > prevSpend;

      // Category breakdown with variance
      const catTotals = {};
      const prevCatTotals = {};

      transactions.forEach(t => {
        const name = t.categories?.name || 'Other';
        catTotals[name] = (catTotals[name] || 0) + parseFloat(t.amount);
      });

      (prevTransactions || []).forEach(t => {
        const name = t.categories?.name || 'Other';
        prevCatTotals[name] = (prevCatTotals[name] || 0) + parseFloat(t.amount);
      });

      const breakdown = Object.keys(catTotals).map(name => {
        const current = catTotals[name];
        const previous = prevCatTotals[name] || 0;
        let variance = 0;
        let variancePercent = 0;

        if (previous > 0) {
          variance = current - previous;
          variancePercent = (variance / previous) * 100;
        } else if (current > 0) {
          variancePercent = 100;
          variance = current;
        }

        return {
          label: name,
          amount: current,
          percent: currentSpend > 0 ? (current / currentSpend) * 100 : 0,
          color: transactions.find(t => t.categories?.name === name)?.categories?.color || COLORS.primary,
          variance,
          variancePercent,
          isUp: variance > 0
        };
      }).sort((a, b) => b.amount - a.amount);

      // Monthly trend (always show 6 months for context)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyTrend = [];
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const m = d.getMonth();
        const y = d.getFullYear();

        const { data: monthTransactions } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('type', 'expense')
          .gte('date', new Date(y, m, 1).toISOString())
          .lt('date', new Date(y, m + 1, 1).toISOString());

        const monthSpend = (monthTransactions || []).reduce((sum, t) => sum + parseFloat(t.amount), 0);

        monthlyTrend.push({
          label: months[m],
          amount: monthSpend,
          height: 0
        });
      }

      const maxSpend = Math.max(...monthlyTrend.map(m => m.amount), 1);
      monthlyTrend.forEach(m => {
        m.height = (m.amount / maxSpend) * 100;
      });

      setReportData({
        currentMonthSpend: currentSpend,
        lastMonthSpend: prevSpend,
        trendPercent: Math.abs(trendPercent),
        isTrendUp,
        breakdown,
        monthlyTrend
      });
    } catch (err) {
      console.error('Error fetching report data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [filterPeriod])
  );

  const filterOptions = [
    { label: 'Weekly', value: 'WEEK' },
    { label: 'Monthly', value: 'MONTH' },
    { label: 'Yearly', value: 'YEAR' }
  ];

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
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }}>
          <Pressable
            style={({ pressed }) => ({
              marginRight: 16,
              padding: 8,
              backgroundColor: COLORS.card,
              borderRadius: 12,
              opacity: pressed ? 0.7 : 1
            })}
            onPress={openDrawer}
          >
            <Menu color={COLORS.text} size={24} />
          </Pressable>
          <Text style={[styles.headerTitle, { marginBottom: 0 }]}>Financial Reports</Text>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          {filterOptions.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.filterButton,
                filterPeriod === option.value && styles.filterButtonActive
              ]}
              onPress={() => setFilterPeriod(option.value)}
            >
              <Text style={[
                styles.filterButtonText,
                filterPeriod === option.value && styles.filterButtonTextActive
              ]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={styles.summaryLabel}>Spent this period</Text>
              <Text style={styles.summaryAmount}>PKR {reportData.currentMonthSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            <View style={[styles.trendBadge, { backgroundColor: reportData.isTrendUp ? 'rgba(244, 67, 54, 0.1)' : 'rgba(76, 175, 80, 0.1)' }]}>
              {reportData.isTrendUp ? <ArrowUp color={COLORS.error} size={14} /> : <ArrowDown color={COLORS.success || '#4caf50'} size={14} />}
              <Text style={[styles.trendText, { color: reportData.isTrendUp ? COLORS.error : (COLORS.success || '#4caf50') }]}>
                {reportData.trendPercent.toFixed(1)}%
              </Text>
            </View>
          </View>
          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
            <Text style={styles.comparisonText}>
              Previous period: <Text style={{ color: COLORS.text }}>PKR {reportData.lastMonthSpend.toLocaleString()}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Spending Breakdown</Text>
          <PieIcon color={COLORS.textSecondary} size={20} />
        </View>

        <View style={styles.breakdownContainer}>
          {reportData.breakdown.length > 0 ? (
            reportData.breakdown.map((item, index) => (
              <BreakdownItem
                key={index}
                label={item.label}
                percent={item.percent}
                amount={`PKR ${item.amount.toLocaleString()}`}
                color={item.color}
                variance={item.variance}
                variancePercent={item.variancePercent}
                isUp={item.isUp}
              />
            ))
          ) : (
            <Text style={{ color: COLORS.textSecondary, textAlign: 'center', padding: 20 }}>No activity for this period</Text>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Monthly Trend</Text>
          <BarChart3 color={COLORS.textSecondary} size={20} />
        </View>

        <View style={styles.chartContainer}>
          <View style={styles.barChart}>
            {reportData.monthlyTrend.map((item, index) => (
              <ChartBar
                key={index}
                label={item.label}
                height={item.height}
                active={index === reportData.monthlyTrend.length - 1}
              />
            ))}
          </View>
        </View>

        {/* Smart Insights Card */}
        <View style={styles.insightsCard}>
          <View style={styles.insightsIcon}>
            <TrendingUp color={COLORS.primary} size={20} />
          </View>
          <View style={styles.insightsTextContainer}>
            <Text style={styles.insightsTitle}>Smart Insights</Text>
            <View style={styles.expandedInsights}>
              {insights.insights.length > 0 ? (
                insights.insights.map((insight, index) => (
                  <Text key={index} style={styles.insightItem}>
                    {insight}
                  </Text>
                ))
              ) : (
                <Text style={styles.insightItem}>
                  Start tracking more transactions to get personalized financial insights.
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Recommendations Section */}
        {insights.recommendations.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ways to Reduce Spending</Text>
              <Info color={COLORS.textSecondary} size={20} />
            </View>
            <View style={styles.recommendationsSection}>
              {insights.recommendations.map((rec, index) => (
                <View
                  key={index}
                  style={[
                    styles.recommendationCard,
                    { borderLeftColor: COLORS.primary }
                  ]}
                >
                  <Text style={styles.recommendationTitle}>
                    📉 {rec.category}
                  </Text>
                  <Text style={styles.recommendationText}>
                    {rec.message}
                  </Text>
                  <Text style={styles.savingsAmount}>
                    Potential monthly savings: PKR {rec.savingsPotential.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Overspending Alerts */}
        {insights.overspending.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Overspending Alerts</Text>
              <Info color={COLORS.error} size={20} />
            </View>
            <View style={styles.recommendationsSection}>
              {insights.overspending.map((alert, index) => (
                <View
                  key={index}
                  style={[
                    styles.recommendationCard,
                    { borderLeftColor: COLORS.error }
                  ]}
                >
                  <Text style={styles.recommendationTitle}>
                    ⚠️ {alert.category}
                  </Text>
                  <Text style={styles.recommendationText}>
                    {alert.reason}
                  </Text>
                  <Text style={{ color: COLORS.error, fontSize: 13, fontWeight: '600' }}>
                    Current: PKR {alert.current.toLocaleString(undefined, { maximumFractionDigits: 0 })} | Limit: PKR {alert.limit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const BreakdownItem = ({ label, percent, amount, color, variance, variancePercent, isUp }) => (
  <View style={styles.breakdownItem}>
    <View style={styles.breakdownHeader}>
      <View style={styles.labelGroup}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.breakdownLabel}>{label}</Text>
        {Math.abs(variancePercent) > 0 && (
          <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center' }}>
            {isUp ? (
              <ArrowUp color={COLORS.error} size={12} />
            ) : (
              <ArrowDown color={COLORS.success || '#4caf50'} size={12} />
            )}
            <Text style={{ color: isUp ? COLORS.error : (COLORS.success || '#4caf50'), fontSize: 12, marginLeft: 4 }}>
              {Math.abs(variancePercent).toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.breakdownAmount}>{amount}</Text>
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
