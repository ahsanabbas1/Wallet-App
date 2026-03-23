import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../constants/theme';
import { BarChart3, PieChart as PieIcon, ArrowUp, ArrowDown, Info } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const Reports = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Financial Reports</Text>

        {/* Monthly Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Spent this month</Text>
          <View style={styles.amountRow}>
            <Text style={styles.summaryAmount}>$2,450.00</Text>
            <View style={styles.trendBadge}>
              <ArrowUp color={COLORS.error} size={14} />
              <Text style={styles.trendText}>+12%</Text>
            </View>
          </View>
          <Text style={styles.comparisonText}>vs $2,180.00 last month</Text>
        </View>

        {/* Spending Breakdown */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Spending Breakdown</Text>
          <PieIcon color={COLORS.textSecondary} size={20} />
        </View>

        <View style={styles.breakdownContainer}>
          <BreakdownItem label="Food & Drink" percent={35} amount="$857.50" color="#FF9800" />
          <BreakdownItem label="Transport" percent={20} amount="$490.00" color="#03A9F4" />
          <BreakdownItem label="Entertainment" percent={15} amount="$367.50" color="#F44336" />
          <BreakdownItem label="Utilities" percent={10} amount="$245.00" color="#FFC107" />
          <BreakdownItem label="Others" percent={20} amount="$490.00" color="#9E9E9E" />
        </View>

        {/* Monthly Trend */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Monthly Trend</Text>
          <BarChart3 color={COLORS.textSecondary} size={20} />
        </View>

        <View style={styles.chartContainer}>
          <View style={styles.barChart}>
            <ChartBar label="Jan" height={40} />
            <ChartBar label="Feb" height={60} />
            <ChartBar label="Mar" height={30} />
            <ChartBar label="Apr" height={80} />
            <ChartBar label="May" height={50} />
            <ChartBar label="Jun" height={70} />
            <ChartBar label="Jul" height={90} active />
          </View>
        </View>

        <View style={styles.insightsCard}>
          <View style={styles.insightsIcon}>
            <Info color={COLORS.primary} size={20} />
          </View>
          <View style={styles.insightsTextContainer}>
            <Text style={styles.insightsTitle}>Smart Insight</Text>
            <Text style={styles.insightsBody}>Your spending on Entertainment is 5% lower than last month. Keep it up!</Text>
          </View>
        </View>
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
      <View style={[styles.progressIndicator, { width: `${percent}%`, backgroundColor: color }]} />
    </View>
  </View>
);

const ChartBar = ({ label, height, active }) => (
  <View style={styles.barContainer}>
    <View style={[styles.bar, { height: `${height}%` }, active && styles.activeBar]} />
    <Text style={[styles.barLabel, active && styles.activeBarLabel]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SIZES.padding,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  summaryAmount: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: 'bold',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  trendText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: 'bold',
  },
  comparisonText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  breakdownContainer: {
    gap: 20,
    marginBottom: 40,
  },
  breakdownItem: {
    gap: 8,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    color: COLORS.text,
    fontSize: 14,
  },
  breakdownAmount: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressIndicator: {
    height: '100%',
    borderRadius: 3,
  },
  chartContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
  },
  barChart: {
    height: 150,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barContainer: {
    alignItems: 'center',
    width: (width - 100) / 7,
  },
  bar: {
    width: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 5,
    marginBottom: 8,
  },
  activeBar: {
    backgroundColor: COLORS.primary,
  },
  barLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  activeBarLabel: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  insightsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    marginBottom: 20,
  },
  insightsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsTextContainer: {
    flex: 1,
  },
  insightsTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  insightsBody: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default Reports;
