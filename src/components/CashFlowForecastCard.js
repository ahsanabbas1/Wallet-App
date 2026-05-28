import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Svg, Path, Line, Circle, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useProfile } from '../context/ProfileContext';
import { SIZES } from '../constants/theme';
import { accountService } from '../services/accountService';
import { paymentService } from '../services/paymentService';
import { transactionService } from '../services/transactionService';

const PERIODS = [
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
];

const toYMD = (d) => (d instanceof Date ? d : new Date(d)).toISOString().split('T')[0];
const fmt   = (n, cur) =>
  `${cur} ${Math.abs(Math.round(Number(n))).toLocaleString()}`;

export default function CashFlowForecastCard({ userId }) {
  const { colors: COLORS } = useTheme();
  const { currency } = useProfile();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [period,   setPeriod]   = useState(0); // index into PERIODS
  const [forecast, setForecast] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [avgDaily, setAvgDaily] = useState(0);

  const days = PERIODS[period].days;

  useEffect(() => {
    if (userId) load(days);
  }, [userId, days]);

  const load = async (numDays) => {
    setLoading(true);
    try {
      const [balance, payments, txResult] = await Promise.all([
        accountService.getTotalBalance(userId),
        paymentService.getPlannedPayments(userId),
        transactionService.getTransactions(userId, { period: '1M' }),
      ]);

      const transactions = txResult?.data || [];
      const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const dailyAvg = totalExpenses / 30;
      setAvgDaily(dailyAvg);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Build a map of payment dates → total amount due
      const paymentMap = {};
      (payments || []).forEach(p => {
        if (p.is_active === 0) return;
        const key = toYMD(p.next_date);
        paymentMap[key] = (paymentMap[key] || 0) + Number(p.amount || 0);
      });

      const points = [];
      let running = Number(balance) || 0;

      for (let d = 0; d <= numDays; d++) {
        const date    = new Date(today.getTime() + d * 86400000);
        const dateKey = toYMD(date);
        if (d > 0) {
          running -= dailyAvg;
          if (paymentMap[dateKey]) running -= paymentMap[dateKey];
        }
        points.push({
          day: d,
          balance: running,
          hasPayment: !!paymentMap[dateKey],
          label: d === 0 ? 'Today'
            : d % Math.ceil(numDays / 5) === 0 || d === numDays
              ? formatLabel(date, numDays)
              : '',
        });
      }
      setForecast(points);
    } catch (e) {
      console.warn('CashFlowForecast error:', e);
    }
    setLoading(false);
  };

  const formatLabel = (date, numDays) => {
    if (numDays <= 30) return `${date.getDate()}/${date.getMonth() + 1}`;
    return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}`;
  };

  const goesNegative = forecast.some(p => p.balance < 0);
  const minBalance   = forecast.length ? Math.min(...forecast.map(p => p.balance)) : 0;
  const maxBalance   = forecast.length ? Math.max(...forecast.map(p => p.balance)) : 0;
  const endBalance   = forecast.length ? forecast[forecast.length - 1].balance : 0;
  const trend        = endBalance >= (forecast[0]?.balance || 0) ? 'up' : 'down';

  return (
    <View style={styles.card}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>Cash Flow Forecast</Text>
          <Text style={styles.cardSubtitle}>
            Based on planned payments + avg daily spend
          </Text>
        </View>
        {/* Period tabs */}
        <View style={styles.tabs}>
          {PERIODS.map((p, i) => (
            <Pressable
              key={p.label}
              style={[styles.tab, period === i && styles.tabActive]}
              onPress={() => setPeriod(i)}
            >
              <Text style={[styles.tabText, period === i && styles.tabTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : forecast.length < 2 ? (
        <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>
            Add transactions to see forecast
          </Text>
        </View>
      ) : (
        <>
          <ForecastChart
            data={forecast}
            COLORS={COLORS}
            goesNegative={goesNegative}
            minBalance={minBalance}
            maxBalance={maxBalance}
          />

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatBox
              label="Avg daily spend"
              value={fmt(avgDaily, currency)}
              color={COLORS.textSecondary}
              styles={styles}
            />
            <StatBox
              label={`In ${days} days`}
              value={fmt(endBalance, currency)}
              prefix={endBalance < 0 ? '−' : ''}
              color={endBalance < 0 ? COLORS.error : COLORS.success || '#22c55e'}
              styles={styles}
            />
            <StatBox
              label="Trend"
              value={trend === 'up' ? '↑ Positive' : '↓ Negative'}
              color={trend === 'up' ? '#22c55e' : COLORS.error}
              styles={styles}
            />
          </View>

          {/* Warning */}
          {goesNegative && (
            <View style={styles.warning}>
              <AlertTriangle color="#f97316" size={14} />
              <Text style={styles.warningText}>
                Balance may go negative — review upcoming payments or reduce spending
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ── Chart ────────────────────────────────────────────────────────────────────

const ForecastChart = ({ data, COLORS, goesNegative, minBalance, maxBalance }) => {
  const screenWidth = Dimensions.get('window').width;
  const W = screenWidth - SIZES.padding * 2 - 32; // card padding
  const H = 160;
  const PAD_L = 10;
  const PAD_R = 10;
  const PAD_T = 12;
  const PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const valRange = maxBalance - minBalance || 1;
  const zeroFrac = goesNegative ? (maxBalance / valRange) : 1; // fraction from top where 0 line sits
  const zeroY    = PAD_T + zeroFrac * chartH;

  const xOf = (i) => PAD_L + (i / (data.length - 1)) * chartW;
  const yOf = (v) => PAD_T + (1 - (v - minBalance) / valRange) * chartH;

  // Build SVG path
  const linePts = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.balance).toFixed(1)}`).join(' ');

  // Positive area (clip above zero line)
  const posAreaPts = [
    `M${xOf(0).toFixed(1)},${zeroY.toFixed(1)}`,
    ...data.map((p, i) => `L${xOf(i).toFixed(1)},${yOf(Math.max(p.balance, 0)).toFixed(1)}`),
    `L${xOf(data.length - 1).toFixed(1)},${zeroY.toFixed(1)}`,
    'Z',
  ].join(' ');

  // Negative area (below zero)
  const negAreaPts = goesNegative ? [
    `M${xOf(0).toFixed(1)},${zeroY.toFixed(1)}`,
    ...data.map((p, i) => `L${xOf(i).toFixed(1)},${yOf(Math.min(p.balance, 0)).toFixed(1)}`),
    `L${xOf(data.length - 1).toFixed(1)},${zeroY.toFixed(1)}`,
    'Z',
  ].join(' ') : null;

  const lineColor = goesNegative ? '#f97316' : '#4f5ff7';

  return (
    <Svg width={W} height={H} style={{ alignSelf: 'center' }}>
      <Defs>
        <SvgGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lineColor} stopOpacity="0.25" />
          <Stop offset="1" stopColor={lineColor} stopOpacity="0.02" />
        </SvgGradient>
        <SvgGradient id="negGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ef4444" stopOpacity="0.05" />
          <Stop offset="1" stopColor="#ef4444" stopOpacity="0.2" />
        </SvgGradient>
      </Defs>

      {/* Positive fill */}
      <Path d={posAreaPts} fill="url(#posGrad)" />

      {/* Negative fill */}
      {negAreaPts && <Path d={negAreaPts} fill="url(#negGrad)" />}

      {/* Zero line */}
      {goesNegative && (
        <Line
          x1={PAD_L} y1={zeroY}
          x2={PAD_L + chartW} y2={zeroY}
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="4,3"
        />
      )}

      {/* Forecast line */}
      <Path d={linePts} stroke={lineColor} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Payment markers */}
      {data.filter(p => p.hasPayment).map((p, i) => (
        <Circle
          key={i}
          cx={xOf(p.day)}
          cy={yOf(p.balance)}
          r="4"
          fill="#f97316"
          stroke={COLORS.card}
          strokeWidth="1.5"
        />
      ))}

      {/* Today dot */}
      <Circle cx={xOf(0)} cy={yOf(data[0]?.balance || 0)} r="5" fill="#4f5ff7" stroke={COLORS.card} strokeWidth="2" />

      {/* X-axis labels */}
      {data.filter(p => p.label).map((p, i) => (
        <SvgText
          key={i}
          x={xOf(p.day)}
          y={H - 4}
          fontSize="9"
          fill={COLORS.textSecondary}
          textAnchor="middle"
        >
          {p.label}
        </SvgText>
      ))}
    </Svg>
  );
};

const StatBox = ({ label, value, color, prefix = '', styles }) => (
  <View style={styles.statBox}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, { color }]}>{prefix}{value}</Text>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (COLORS) => StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 2,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginBottom: 3,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  warningText: {
    flex: 1,
    color: '#f97316',
    fontSize: 12,
    lineHeight: 16,
  },
});
