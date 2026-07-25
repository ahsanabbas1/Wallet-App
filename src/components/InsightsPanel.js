import React, { useMemo, useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { TrendingUp, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS } from '../constants/theme';
import GaugeChart from './Charts/GaugeChart';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const InsightsPanel = ({ performanceMetrics, totals }) => {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [expanded, setExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const secondaryMetrics = useMemo(() => ([
    { label: 'Outlook',    value: totals.totalAmount > 0 ? 85 : 15 },
    { label: 'Spendings',  value: Math.min((totals.monthlySpend / (totals.totalIncome || 1)) * 100, 100) },
    { label: 'Credit',     value: Math.min((totals.totalIncome / 100000) * 100, 100) },
    { label: 'Debit',      value: Math.min((totals.monthlySpend / 100000) * 100, 100) },
  ]), [totals]);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotateAnim, {
      toValue: expanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setExpanded(v => !v);
  };

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Wallet Insights</Text>
          <Text style={styles.sub}>30-day performance & future outlook</Text>
        </View>
        <View style={styles.pill}>
          <TrendingUp color={COLORS.accent} size={14} style={{ marginRight: 6 }} />
          <Text style={styles.pillText}>Live Analysis</Text>
        </View>
      </View>

      <View style={styles.predictiveRow}>
        <GaugeChart score={performanceMetrics.balanceScore} label="Balance Pred." />
        <View style={styles.verticalDivider} />
        <GaugeChart score={performanceMetrics.cashFlowScore} label="Cash-Flow Pred." />
      </View>

      {!expanded && (
        <View style={styles.summaryRow}>
          {secondaryMetrics.map(m => (
            <View key={m.label} style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{Math.round(m.value)}%</Text>
              <Text style={styles.summaryLabel}>{m.label}</Text>
            </View>
          ))}
        </View>
      )}

      {expanded && (
        <View style={styles.performanceGrid}>
          {secondaryMetrics.map(m => (
            <View key={m.label} style={styles.gridItem}>
              <GaugeChart score={m.value} label={m.label} />
            </View>
          ))}
        </View>
      )}

      <Pressable style={styles.toggleBtn} onPress={toggleExpanded}>
        <Text style={styles.toggleText}>{expanded ? 'Show less' : 'See full insights'}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronDown color={COLORS.primary} size={16} />
        </Animated.View>
      </Pressable>
    </View>
  );
};

const makeStyles = (COLORS) => StyleSheet.create({
  card: {
    marginTop: 30,
    padding: 20,
    backgroundColor: COLORS.glass,
    borderRadius: RADIUS.xxl,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  sub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.glassLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  pillText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: 'bold',
  },
  predictiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: COLORS.glassLight,
    borderRadius: 20,
    paddingVertical: 15,
    marginBottom: 16,
  },
  verticalDivider: {
    width: 1,
    height: '60%',
    backgroundColor: COLORS.glassBorder,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -5,
  },
  gridItem: {
    width: '48%',
    backgroundColor: COLORS.glassLight,
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  toggleText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default InsightsPanel;
