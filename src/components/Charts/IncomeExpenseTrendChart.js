import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Dimensions, ActivityIndicator, StyleSheet } from 'react-native';
import { Svg, Polyline, Circle, G, Text as SvgText, Line } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { useProfile } from '../../context/ProfileContext';
import { transactionService } from '../../services/transactionService';

const PERIODS = [
  { label: 'Monthly', key: '1M', num: 30, type: 'day' },
  { label: '6 Months', key: '6M', num: 6, type: 'month' },
  { label: 'Yearly', key: '1Y', num: 12, type: 'month' },
];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function groupByDay(transactions, days) {
  const map = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    map[key] = { label: key.slice(5), income: 0, expense: 0, net: 0 };
  }
  transactions.forEach(t => {
    const key = t.date.split('T')[0];
    if (map[key]) {
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'income') map[key].income += amt;
      else if (t.type === 'expense') map[key].expense += amt;
    }
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_, v]) => ({ ...v, net: v.income - v.expense }));
}

function groupByMonth(transactions, numMonths) {
  const map = {};
  const now = new Date();
  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map[key] = { label: MONTH_NAMES[d.getMonth()], income: 0, expense: 0, net: 0 };
  }
  transactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (map[key]) {
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'income') map[key].income += amt;
      else if (t.type === 'expense') map[key].expense += amt;
    }
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_, v]) => ({ ...v, net: v.income - v.expense }));
}

const IncomeExpenseTrendChart = ({ userId, light }) => {
  const { colors: COLORS } = useTheme();
  const { currency } = useProfile();
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const c = light
    ? { ...COLORS, border: 'rgba(255,255,255,0.15)', textSecondary: 'rgba(255,255,255,0.7)', card: 'rgba(255,255,255,0.9)' }
    : COLORS;

  const period = PERIODS[activeTab];

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);

    const fetchData = async () => {
      try {
        const res = await transactionService.getTransactions(userId, { period: period.key });
        const txs = res?.data || [];
        const grouped = period.type === 'day'
          ? groupByDay(txs, period.num)
          : groupByMonth(txs, period.num);
        if (!cancelled) setData(grouped);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [userId, period.key, period.type, period.num]);

  const screenWidth = Dimensions.get('window').width;
  const padding = 16;
  const cardPadding = padding * 2;
  const chartWidth = screenWidth - cardPadding - 32;
  const chartHeight = 170;
  const pad = { top: 16, right: 8, bottom: 28, left: 48 };
  const drawW = chartWidth - pad.left - pad.right;
  const drawH = chartHeight - pad.top - pad.bottom;

  if (loading) {
    return (
      <View style={{ height: chartHeight + 40, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.primary} size="small" />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={{ height: chartHeight + 40, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: c.textSecondary, fontSize: 13 }}>No transaction data</Text>
      </View>
    );
  }

  const allValues = data.flatMap(d => [d.income, d.expense, d.net]);
  const dataMin = Math.min(...allValues, 0);
  const dataMax = Math.max(...allValues, 0);
  const range = dataMax - dataMin || 1;

  const n = data.length;
  const getX = (i) => pad.left + (n > 1 ? (i / (n - 1)) * drawW : drawW / 2);
  const getY = (v) => pad.top + drawH * ((dataMax - v) / range);

  const buildPoints = (series) =>
    data.map((d, i) => `${getX(i)},${getY(d[series])}`).join(' ');

  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = dataMin + (range / ySteps) * i;
    return { val, y: pad.top + drawH * (1 - i / ySteps) };
  });

  const fmtY = (v) => {
    const abs = Math.abs(v);
    if (abs >= 100000) return `${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1000) return `${(abs / 1000).toFixed(0)}k`;
    return `${Math.round(abs)}`;
  };

  const maxXLabels = 7;
  const labelInterval = Math.max(1, Math.floor(n / maxXLabels));
  const xLabels = data.filter((_, i) => i % labelInterval === 0 || i === n - 1);

  const LINE_COLORS = {
    income: '#0bda73',
    expense: '#f44336',
    net: light ? '#fff' : COLORS.primary,
  };

  return (
    <View style={{ marginTop: 16 }}>
      {/* Tabs */}
      <View style={localStyles.tabRow}>
        {PERIODS.map((p, i) => (
          <Pressable
            key={p.key}
            style={[localStyles.tab, light && { backgroundColor: 'rgba(255,255,255,0.1)' }, activeTab === i && { backgroundColor: light ? 'rgba(255,255,255,0.25)' : COLORS.primary }]}
            onPress={() => setActiveTab(i)}
          >
            <Text style={[localStyles.tabText, { color: activeTab === i ? '#fff' : c.textSecondary }]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Chart */}
      <Svg width={chartWidth} height={chartHeight}>
        {/* Y-axis grid lines */}
        {yLabels.map((item, i) => (
          <G key={i}>
            <Line
              x1={pad.left} y1={item.y}
              x2={chartWidth - pad.right} y2={item.y}
              stroke={c.border} strokeWidth="1" strokeDasharray="4,4"
            />
            <SvgText
              x={pad.left - 6} y={item.y + 4}
              fontSize="9" fill={c.textSecondary} textAnchor="end"
            >
              {item.val === 0 ? '0' : fmtY(item.val)}
            </SvgText>
          </G>
        ))}

        {/* Zero baseline */}
        {dataMin < 0 && dataMax > 0 && (
          <Line
            x1={pad.left} y1={getY(0)}
            x2={chartWidth - pad.right} y2={getY(0)}
            stroke={c.textSecondary} strokeWidth="1" strokeDasharray="2,2"
            opacity={0.4}
          />
        )}

        {/* Income line + points */}
        <Polyline points={buildPoints('income')} stroke={LINE_COLORS.income} strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <Circle key={`inc-${i}`} cx={getX(i)} cy={getY(d.income)} r="3" fill={LINE_COLORS.income} stroke={c.card} strokeWidth="1.5" />
        ))}

        {/* Expense line + points */}
        <Polyline points={buildPoints('expense')} stroke={LINE_COLORS.expense} strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <Circle key={`exp-${i}`} cx={getX(i)} cy={getY(d.expense)} r="3" fill={LINE_COLORS.expense} stroke={c.card} strokeWidth="1.5" />
        ))}

        {/* Net line + points */}
        <Polyline points={buildPoints('net')} stroke={LINE_COLORS.net} strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <Circle key={`net-${i}`} cx={getX(i)} cy={getY(d.net)} r="3" fill={LINE_COLORS.net} stroke={c.card} strokeWidth="1.5" />
        ))}

        {/* X-axis labels */}
        {xLabels.map((d, i) => {
          const idx = data.indexOf(d);
          const x = getX(idx);
          return (
            <SvgText
              key={`x-${i}`}
              x={x} y={chartHeight - 4}
              fontSize="9" fill={c.textSecondary} textAnchor="middle"
            >
              {d.label}
            </SvgText>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={localStyles.legend}>
        {[
          { key: 'income', label: 'Income', color: LINE_COLORS.income },
          { key: 'expense', label: 'Expense', color: LINE_COLORS.expense },
          { key: 'net', label: 'Net', color: LINE_COLORS.net },
        ].map(item => (
          <View key={item.key} style={localStyles.legendItem}>
            <View style={[localStyles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[localStyles.legendText, { color: c.textSecondary }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  legendText: {
    fontSize: 11,
  },
});

export default IncomeExpenseTrendChart;
