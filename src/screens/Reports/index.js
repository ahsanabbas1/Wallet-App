import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';
import { BarChart3, PieChart as PieIcon, ArrowUp, ArrowDown, Info, Menu, TrendingUp } from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { styles } from './styles';

const { width } = Dimensions.get('window');

const Reports = () => {
  const { openDrawer } = useDrawer();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    currentMonthSpend: 0,
    lastMonthSpend: 0,
    trendPercent: 0,
    isTrendUp: false,
    breakdown: [],
    monthlyTrend: []
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const startOfCurrentMonth = new Date(currentYear, currentMonth, 1).toISOString();
      const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1).toISOString();
      const endOfLastMonth = new Date(currentYear, currentMonth, 0).toISOString();
      const sixMonthsAgo = new Date(currentYear, currentMonth - 5, 1).toISOString();
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          categories (
            name,
            color,
            icon
          )
        `)
        .eq('user_id', session.user.id)
        .eq('type', 'expense')
        .gte('date', sixMonthsAgo);

      if (error) throw error;
      const transactions = data || [];

      const currentMonthTrans = transactions.filter(t => new Date(t.date) >= new Date(startOfCurrentMonth));
      const currentMonthSpend = currentMonthTrans.reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const lastMonthTrans = transactions.filter(t => {
        const d = new Date(t.date);
        return d >= new Date(startOfLastMonth) && d <= new Date(endOfLastMonth);
      });
      const lastMonthSpend = lastMonthTrans.reduce((sum, t) => sum + parseFloat(t.amount), 0);

      let trendPercent = 0;
      if (lastMonthSpend > 0) {
        trendPercent = ((currentMonthSpend - lastMonthSpend) / lastMonthSpend) * 100;
      }
      const isTrendUp = currentMonthSpend > lastMonthSpend;

      const catTotals = {};
      currentMonthTrans.forEach(t => {
        const name = t.categories?.name || 'Other';
        catTotals[name] = (catTotals[name] || 0) + parseFloat(t.amount);
      });

      const breakdown = Object.keys(catTotals).map(name => ({
        label: name,
        amount: catTotals[name],
        percent: currentMonthSpend > 0 ? (catTotals[name] / currentMonthSpend) * 100 : 0,
        color: transactions.find(t => t.categories?.name === name)?.categories?.color || COLORS.primary
      })).sort((a, b) => b.amount - a.amount);

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const m = d.getMonth();
        const y = d.getFullYear();
        
        const monthSpend = transactions.filter(t => {
          const td = new Date(t.date);
          return td.getMonth() === m && td.getFullYear() === y;
        }).reduce((sum, t) => sum + parseFloat(t.amount), 0);

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
        currentMonthSpend,
        lastMonthSpend,
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
    }, [])
  );

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

        <View style={styles.summaryCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={styles.summaryLabel}>Spent this month</Text>
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
              Previous month: <Text style={{ color: COLORS.text }}>PKR {reportData.lastMonthSpend.toLocaleString()}</Text>
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

        <View style={styles.insightsCard}>
          <View style={styles.insightsIcon}>
            <TrendingUp color={COLORS.primary} size={20} />
          </View>
          <View style={styles.insightsTextContainer}>
            <Text style={styles.insightsTitle}>Smart Insight</Text>
            <Text style={styles.insightsBody}>
              {reportData.isTrendUp 
                ? `Your spending is up by ${reportData.trendPercent.toFixed(1)}% compared to last month. Consider reviewing your top categories.`
                : reportData.lastMonthSpend > 0 
                  ? `Great job! You've spent ${reportData.trendPercent.toFixed(1)}% less than last month.`
                  : "Start tracking more transactions to get personalized financial insights."}
            </Text>
          </View>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const BreakdownItem = ({ label, percent, amount, color }) => (
  <View style={styles.breakdownItem}>
    <View style={styles.breakdownHeader}>
      <View style={styles.labelGroup}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.breakdownLabel}>{label}</Text>
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
