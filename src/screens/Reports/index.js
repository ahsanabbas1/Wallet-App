import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { BarChart3, PieChart as PieIcon, ArrowUp, Info, Menu } from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { styles } from './styles';

const Reports = () => {
  const { openDrawer } = useDrawer();
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <TouchableOpacity 
          style={{ marginRight: 16 }}
          onPress={openDrawer}
        >
          <Menu color={COLORS.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financial Reports</Text>
      </View>

        {/* Monthly Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Spent this month</Text>
          <View style={styles.amountRow}>
            <Text style={styles.summaryAmount}>PKR 2,450.00</Text>
            <View style={styles.trendBadge}>
              <ArrowUp color={COLORS.error} size={14} />
              <Text style={styles.trendText}>+12%</Text>
            </View>
          </View>
          <Text style={styles.comparisonText}>vs PKR 2,180.00 last month</Text>
        </View>

        {/* Spending Breakdown */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Spending Breakdown</Text>
          <PieIcon color={COLORS.textSecondary} size={20} />
        </View>

        <View style={styles.breakdownContainer}>
          <BreakdownItem label="Food & Drink" percent={35} amount="PKR 857.50" color="#FF9800" />
          <BreakdownItem label="Transport" percent={20} amount="PKR 490.00" color="#03A9F4" />
          <BreakdownItem label="Entertainment" percent={15} amount="PKR 367.50" color="#F44336" />
          <BreakdownItem label="Utilities" percent={10} amount="PKR 245.00" color="#FFC107" />
          <BreakdownItem label="Others" percent={20} amount="PKR 490.00" color="#9E9E9E" />
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

export default Reports;
