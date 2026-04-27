import React from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { Svg, Rect, G, Text as SvgText, Line } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const IncomeExpenseBarChart = ({ data = [], height = 220 }) => {
  const { colors: COLORS } = useTheme();
  if (!data.length) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: COLORS.textSecondary }}>No data available</Text>
      </View>
    );
  }

  const chartWidth = SCREEN_WIDTH - 64;
  const chartHeight = height - 60;
  const padding = { left: 52, bottom: 28, top: 10 };
  const drawWidth = chartWidth - padding.left;
  const drawHeight = chartHeight - padding.bottom - padding.top;

  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1);
  const barGroupW = drawWidth / data.length;
  const barW = Math.max(barGroupW * 0.3, 4);
  const gap = 3;

  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = (maxVal / ySteps) * (ySteps - i);
    return { val, y: padding.top + (drawHeight / ySteps) * i };
  });

  const fmt = (n) => n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`;

  return (
    <View>
      <Svg width={chartWidth} height={height}>
        {/* Grid lines */}
        {yLabels.map((item, i) => (
          <G key={i}>
            <Line
              x1={padding.left} y1={item.y}
              x2={chartWidth} y2={item.y}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4,4"
            />
            <SvgText x={padding.left - 6} y={item.y + 4}
              fontSize="9" fill={COLORS.textSecondary} textAnchor="end">
              {fmt(item.val)}
            </SvgText>
          </G>
        ))}

        {/* Bars */}
        {data.map((item, i) => {
          const centerX = padding.left + barGroupW * i + barGroupW / 2;
          const incomeH = drawHeight * (item.income / maxVal);
          const expenseH = drawHeight * (item.expense / maxVal);
          const baseY = padding.top + drawHeight;

          return (
            <G key={i}>
              {/* Income bar */}
              <Rect
                x={centerX - barW - gap / 2}
                y={baseY - incomeH}
                width={barW}
                height={Math.max(incomeH, 2)}
                rx={3}
                fill="#0bda73"
                opacity={0.85}
              />
              {/* Expense bar */}
              <Rect
                x={centerX + gap / 2}
                y={baseY - expenseH}
                width={barW}
                height={Math.max(expenseH, 2)}
                rx={3}
                fill="#f44336"
                opacity={0.85}
              />
              {/* X label */}
              <SvgText
                x={centerX}
                y={baseY + 16}
                fontSize="9"
                fill={COLORS.textSecondary}
                textAnchor="middle"
              >
                {item.month}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#0bda73' }]} />
          <Text style={styles.legendText}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f44336' }]} />
          <Text style={styles.legendText}>Expense</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});

export default IncomeExpenseBarChart;
