import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Svg, Polyline, Circle, G, Text as SvgText, Line } from 'react-native-svg';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useProfile } from '../context/ProfileContext';
import { formatAmount } from '../utils/formatters';
import { SIZES } from '../constants/theme';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PERIOD_LABELS = { '1M': 'Last 30 Days', '6M': 'Last 6 Months', '1Y': 'Last 12 Months' };

const fmtLabel = (dateStr, periodKey) => {
  const [, m, d] = dateStr.split('-').map(Number);
  return periodKey === '1M' ? `${MONTH_NAMES[m - 1]} ${d}` : MONTH_NAMES[m - 1];
};

// Abbreviates to K/M, preserving sign — mirrors formatAmount's thresholds
const fmtAxis = (v) => `${v < 0 ? '-' : ''}${formatAmount(v)}`;

const NetWorthCard = ({ history, periodKey = '1M', balanceVisible }) => {
  const { colors: COLORS } = useTheme();
  const { currency } = useProfile();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const mv = (formatted) => balanceVisible !== false ? formatted : '••••••';

  const chartData = useMemo(
    () => (history || []).map(h => ({ label: fmtLabel(h.date, periodKey), amount: h.total_balance })),
    [history, periodKey]
  );

  const change = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].amount;
    const last = chartData[chartData.length - 1].amount;
    if (first === 0) return null;
    return ((last - first) / Math.abs(first)) * 100;
  }, [chartData]);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - (SIZES.padding * 2) - 32;
  const chartHeight = 220;
  const pad = { top: 16, right: 16, bottom: 28, left: 54 };
  const drawW = chartWidth - pad.left - pad.right;
  const drawH = chartHeight - pad.top - pad.bottom;

  const layout = useMemo(() => {
    if (chartData.length < 2) return null;
    const values = chartData.map(d => d.amount);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const span = (rawMax - rawMin) || Math.abs(rawMax) || 1;
    const cushion = span * 0.15;
    const dataMin = rawMin - cushion;
    const dataMax = rawMax + cushion;
    const range = (dataMax - dataMin) || 1;

    const n = chartData.length;
    const getX = (i) => pad.left + (n > 1 ? (i / (n - 1)) * drawW : drawW / 2);
    const getY = (v) => pad.top + drawH * ((dataMax - v) / range);

    const points = chartData.map((d, i) => `${getX(i)},${getY(d.amount)}`).join(' ');
    const areaPoints = [
      `${getX(0)},${pad.top + drawH}`,
      ...chartData.map((d, i) => `${getX(i)},${getY(d.amount)}`),
      `${getX(n - 1)},${pad.top + drawH}`,
    ].join(' ');

    const ySteps = 4;
    const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
      const val = dataMin + (range / ySteps) * i;
      return { val, y: pad.top + drawH * (1 - i / ySteps) };
    });

    const maxXLabels = periodKey === '1M' ? 6 : 6;
    const labelInterval = Math.max(1, Math.floor(n / maxXLabels));
    const xLabels = chartData
      .map((d, i) => ({ ...d, i }))
      .filter((d, idx) => idx % labelInterval === 0 || idx === n - 1);

    return { getX, getY, points, areaPoints, yLabels, xLabels, n };
  }, [chartData, drawW, drawH, pad.left, pad.top, periodKey]);

  if (chartData.length < 2) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Net Worth History</Text>
        <Text style={styles.emptyText}>
          Keep using the app — your balance trend will appear here after a few days.
        </Text>
      </View>
    );
  }

  const lineColor = COLORS.primary;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Net Worth History</Text>
          <Text style={styles.subtitle}>{PERIOD_LABELS[periodKey] || PERIOD_LABELS['1M']}</Text>
        </View>
        {change !== null && (
          <View style={styles.changeRow}>
            {change >= 0
              ? <TrendingUp color={COLORS.success} size={14} />
              : <TrendingDown color={COLORS.error} size={14} />}
            <Text style={[styles.changeText, { color: change >= 0 ? COLORS.success : COLORS.error }]}>
              {mv(`${change >= 0 ? '+' : ''}${change.toFixed(1)}%`)}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.currentValue}>
        {mv(`${currency} ${formatAmount(chartData[chartData.length - 1].amount)}`)}
      </Text>

      <Svg width={chartWidth} height={chartHeight} style={{ marginTop: 12 }}>
        {layout.yLabels.map((item, i) => (
          <G key={i}>
            <Line
              x1={pad.left} y1={item.y}
              x2={chartWidth - pad.right} y2={item.y}
              stroke={COLORS.divider} strokeWidth="1" strokeDasharray="4,4"
            />
            <SvgText x={pad.left - 8} y={item.y + 4} fontSize="10" fill={COLORS.textSecondary} textAnchor="end">
              {fmtAxis(item.val)}
            </SvgText>
          </G>
        ))}

        <Polyline points={layout.areaPoints} fill={lineColor} fillOpacity="0.12" stroke="none" />
        <Polyline points={layout.points} stroke={lineColor} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {chartData.map((d, i) => (
          <Circle key={i} cx={layout.getX(i)} cy={layout.getY(d.amount)} r="3" fill={lineColor} stroke={COLORS.card} strokeWidth="1.5" />
        ))}

        {layout.xLabels.map((d, idx) => (
          <SvgText
            key={idx}
            x={layout.getX(d.i)}
            y={chartHeight - 6}
            fontSize="10"
            fill={COLORS.textSecondary}
            textAnchor={d.i === layout.n - 1 ? 'end' : d.i === 0 ? 'start' : 'middle'}
          >
            {d.label}
          </SvgText>
        ))}
      </Svg>
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
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  currentValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 8,
  },
});

export default NetWorthCard;
