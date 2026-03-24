import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { PieChart, TrendingUp, Landmark, Calculator, Receipt, ShieldAlert, ChevronRight } from 'lucide-react-native';
import { styles } from './styles';

const FinancialSuite = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Financial Suite</Text>

        {/* Net Worth Card */}
        <View style={styles.netWorthCard}>
          <Text style={styles.netWorthLabel}>Estimated Net Worth</Text>
          <View style={styles.netWorthRow}>
            <Text style={styles.netWorthAmount}>PKR 125,400.00</Text>
            <View style={styles.trendBadge}>
              <TrendingUp color={COLORS.accent} size={14} />
              <Text style={styles.trendText}>+5.2%</Text>
            </View>
          </View>
          <Text style={styles.netWorthSub}>Updated 1 hour ago</Text>
        </View>

        {/* Asset Allocation */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Asset Allocation</Text>
          <PieChart color={COLORS.textSecondary} size={20} />
        </View>

        <View style={styles.allocationCard}>
          <AllocationItem label="Investments" percent={60} color={COLORS.primary} />
          <AllocationItem label="Real Estate" percent={20} color="#9C27B0" />
          <AllocationItem label="Cash" percent={15} color={COLORS.accent} />
          <AllocationItem label="Others" percent={5} color="#607D8B" />
        </View>

        {/* Essential Tools */}
        <Text style={styles.sectionTitle}>Essential Tools</Text>
        <View style={styles.toolsGrid}>
          <ToolItem icon={TrendingUp} title="Investment Tracker" sub="Stocks & Crypto" color="#4CAF50" />
          <ToolItem icon={Receipt} title="Tax Planner" sub="Q3 Projections" color="#FF9800" />
          <ToolItem icon={Calculator} title="Retirement" sub="Goal: PKR 2.5M" color="#2196F3" />
          <ToolItem icon={ShieldAlert} title="Debt Manager" sub="2 Active Loans" color="#F44336" />
        </View>

        {/* Connected Institutions */}
        <TouchableOpacity style={styles.connectCard}>
          <View style={styles.connectIcon}>
            <Landmark color={COLORS.text} size={24} />
          </View>
          <View style={styles.connectText}>
            <Text style={styles.connectTitle}>Connected Institutions</Text>
            <Text style={styles.connectSub}>3 Banks & 2 Brokerages linked</Text>
          </View>
          <ChevronRight color={COLORS.textSecondary} size={20} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const AllocationItem = ({ label, percent, color }) => (
  <View style={styles.allocationItem}>
    <View style={styles.allocationTextRow}>
      <Text style={styles.allocationLabel}>{label}</Text>
      <Text style={styles.allocationPercent}>{percent}%</Text>
    </View>
    <View style={styles.allocationBarContainer}>
      <View style={[styles.allocationBar, { width: `${percent}%`, backgroundColor: color }]} />
    </View>
  </View>
);

const ToolItem = ({ icon: Icon, title, sub, color }) => (
  <TouchableOpacity style={styles.toolCard}>
    <View style={[styles.toolIcon, { backgroundColor: color + '15' }]}>
      <Icon color={color} size={24} />
    </View>
    <Text style={styles.toolTitle}>{title}</Text>
    <Text style={styles.toolSub}>{sub}</Text>
  </TouchableOpacity>
);

export default FinancialSuite;
