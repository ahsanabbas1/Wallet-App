import React, { useMemo } from 'react';
import { View, Text, Pressable, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, Target, DollarSign, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useProfile } from '../context/ProfileContext';
import { formatAmount } from '../utils/formatters';
import IncomeExpenseTrendChart from './Charts/IncomeExpenseTrendChart';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS = { GOOD: 'good', FAIR: 'fair', LOW: 'low' };

const HealthScoreCard = ({ totals, expenseChange, userId, gradient, balanceVisible }) => {
  const { colors: COLORS } = useTheme();
  const { currency } = useProfile();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const c = gradient
    ? { ...COLORS, text: '#fff', textSecondary: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.15)', card: 'rgba(255,255,255,0.9)' }
    : COLORS;

  const mv = (formatted) => balanceVisible !== false ? formatted : '••••••';

  const { metrics, score, tip } = useMemo(() => {
    const incoming = totals.incoming || 0;
    const outgoing = totals.outgoing || 0;
    const totalBudget = totals.budget?.totalBudget || 0;
    const totalUsed = totals.budget?.totalUsed || 0;
    const budgetCount = totals.budget?.count || 0;
    const change = expenseChange || 0;

    const cashFlow = incoming - outgoing;

    const savingsRate = incoming > 0 ? (cashFlow / incoming) * 100 : 0;

    const budgetUsage = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

    const budgetRemainingPct = totalBudget > 0 ? Math.max((totalBudget - totalUsed) / totalBudget * 100, 0) : 0;

    const savingsScore = Math.min(Math.max(savingsRate / 30, 0), 1) * 40;
    const budgetScore = budgetCount > 0 ? Math.min(budgetRemainingPct / 100, 1) * 30 : 15;
    let cashFlowScore = 0;
    if (cashFlow >= outgoing * 0.2) cashFlowScore = 30;
    else if (cashFlow >= 0) cashFlowScore = 20;
    else if (outgoing > 0 && cashFlow >= -outgoing * 0.1) cashFlowScore = 10;

    const totalScore = Math.round(savingsScore + budgetScore + cashFlowScore);

    let savingsStatus = savingsRate >= 20 ? STATUS.GOOD : savingsRate >= 10 ? STATUS.FAIR : STATUS.LOW;
    let budgetStatus = STATUS.GOOD;
    if (budgetCount > 0) {
      if (budgetUsage > 90) budgetStatus = STATUS.LOW;
      else if (budgetUsage > 70) budgetStatus = STATUS.FAIR;
    }
    const cashFlowStatus = cashFlow >= 0 ? STATUS.GOOD : STATUS.LOW;

    let tip = '';
    if (cashFlow < 0) {
      tip = 'Your expenses exceed your income. Try reducing non-essential spending.';
    } else if (budgetCount > 0 && budgetUsage > 100) {
      tip = `You've exceeded your total budget this month.`;
    } else if (savingsRate < 10 && incoming > 0) {
      tip = 'Try to save at least 10% of your income.';
    } else if (change > 10) {
      tip = `Spending is up ${Math.round(change)}% from last month.`;
    } else if (budgetCount > 0 && budgetUsage > 80) {
      tip = 'You\'re close to your budget limit. Watch your spending.';
    } else if (incoming > 0) {
      tip = 'Great job! You\'re on solid financial footing.';
    }

    return {
      metrics: { savingsRate, budgetUsage, budgetCount, cashFlow, savingsStatus, budgetStatus, cashFlowStatus },
      score: totalScore,
      tip,
    };
  }, [totals, expenseChange]);

  const scoreColor = score >= 70 ? COLORS.success : score >= 40 ? '#f59e0b' : COLORS.error;

  const StatusIcon = ({ status }) => {
    if (status === STATUS.GOOD) return <CheckCircle2 color={gradient ? '#fff' : COLORS.success} size={16} />;
    if (status === STATUS.FAIR) return <AlertTriangle color={gradient ? '#fff' : '#f59e0b'} size={16} />;
    return <XCircle color={gradient ? '#fff' : COLORS.error} size={16} />;
  };

  const MetricBar = ({ value, color }) => (
    <View style={[styles.barTrack, { backgroundColor: c.border }]}>
      <View style={[styles.barFill, { width: `${Math.min(value, 100)}%`, backgroundColor: gradient ? '#fff' : color }]} />
    </View>
  );

  const content = (
    <>
      {gradient && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', marginBottom: 2 }}>Total Net Worth</Text>
              <Text style={{ color: '#fff', fontSize: SCREEN_WIDTH * 0.07, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>
                {mv(`${currency} ${formatAmount(totals.totalAmount)}`)}
              </Text>
              <Text style={{ color: expenseChange > 0 ? '#ff5252' : '#00e676', fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                {expenseChange > 0 ? '↑' : '↓'} {Math.abs(expenseChange).toFixed(1)}% vs last month
              </Text>
            </View>
            <TrendingUp color="rgba(255,255,255,0.4)" size={22} />
          </View>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 16 }} />
        </>
      )}

      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Financial Health</Text>
        <View style={[styles.scoreCircle, { backgroundColor: gradient ? 'rgba(255,255,255,0.2)' : scoreColor + '20' }]}>
          <Text style={[styles.scoreNumber, { color: gradient ? '#fff' : scoreColor }]}>{score}</Text>
          <Text style={[styles.scoreLabel, { color: gradient ? 'rgba(255,255,255,0.7)' : scoreColor }]}>/100</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metricRow}>
          <View style={styles.metricLeft}>
            <TrendingUp color={c.textSecondary} size={16} />
            <Text style={[styles.metricLabel, { color: c.textSecondary }]}>Savings</Text>
          </View>
          <View style={styles.metricCenter}>
            <MetricBar value={metrics.savingsRate} color={metrics.savingsStatus === STATUS.GOOD ? COLORS.success : metrics.savingsStatus === STATUS.FAIR ? '#f59e0b' : COLORS.error} />
          </View>
          <View style={styles.metricRight}>
            <Text style={[styles.metricValue, { color: c.text }]}>{Math.round(metrics.savingsRate)}%</Text>
            <StatusIcon status={metrics.savingsStatus} />
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricLeft}>
            <Target color={c.textSecondary} size={16} />
            <Text style={[styles.metricLabel, { color: c.textSecondary }]}>Budget</Text>
          </View>
          <View style={styles.metricCenter}>
            {metrics.budgetCount > 0 ? (
              <MetricBar value={metrics.budgetUsage} color={metrics.budgetStatus === STATUS.GOOD ? COLORS.success : metrics.budgetStatus === STATUS.FAIR ? '#f59e0b' : COLORS.error} />
            ) : (
              <Text style={[styles.noData, { color: c.textSecondary }]}>No budgets set</Text>
            )}
          </View>
          <View style={styles.metricRight}>
            {metrics.budgetCount > 0 && (
              <>
                <Text style={[styles.metricValue, { color: c.text }]}>{Math.round(metrics.budgetUsage)}%</Text>
                <StatusIcon status={metrics.budgetStatus} />
              </>
            )}
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricLeft}>
            <DollarSign color={c.textSecondary} size={16} />
            <Text style={[styles.metricLabel, { color: c.textSecondary }]}>Cash Flow</Text>
          </View>
          <View style={styles.metricCenter}>
            <Text style={[styles.cashFlowValue, { color: gradient ? '#fff' : (metrics.cashFlow >= 0 ? COLORS.success : COLORS.error) }]}>
              {metrics.cashFlow >= 0 ? '+' : ''}{currency} {formatAmount(Math.abs(metrics.cashFlow))}
            </Text>
          </View>
          <View style={styles.metricRight}>
            <StatusIcon status={metrics.cashFlowStatus} />
          </View>
        </View>
      </View>

      <IncomeExpenseTrendChart userId={userId} light={gradient} />

      {tip ? (
        <View style={[styles.tipRow, { borderTopColor: c.border }]}>
          <Info color={gradient ? 'rgba(255,255,255,0.7)' : COLORS.primary} size={14} />
          <Text style={[styles.tipText, { color: c.textSecondary }]}>{tip}</Text>
        </View>
      ) : null}
    </>
  );

  if (gradient) {
    return (
      <LinearGradient
        colors={['#4f5ff7', '#7c4dff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderWidth: 0 }]}
      >
        {content}
      </LinearGradient>
    );
  }

  return (
    <View style={styles.card}>
      {content}
    </View>
  );
};

const makeStyles = (COLORS) => StyleSheet.create({
  card: {
    backgroundColor: COLORS.glass,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  scoreCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
  },
  metrics: {
    gap: 12,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricLeft: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  metricCenter: {
    flex: 1,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  noData: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  metricRight: {
    width: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  cashFlowValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
});

export default HealthScoreCard;
