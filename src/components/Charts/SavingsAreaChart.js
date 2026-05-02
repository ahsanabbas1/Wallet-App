import React from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { Svg, Path, Circle, Polyline, G, Text as SvgText, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SavingsAreaChart = ({ data = [], height = 220 }) => {
  const { colors: COLORS } = useTheme();
  const styles = React.useMemo(() => makeStyles(COLORS), [COLORS]);
  if (!data.length) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: COLORS.textSecondary }}>No data available</Text>
      </View>
    );
  }

  const chartWidth = SCREEN_WIDTH - 64;
  const chartHeight = height - 60;
  const padding = { left: 56, bottom: 28, top: 14 };
  const drawWidth = chartWidth - padding.left;
  const drawHeight = chartHeight - padding.bottom - padding.top;

  const values = data.map(d => d.cumulativeSavings);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const getX = (i) => padding.left + (i / (data.length - 1 || 1)) * drawWidth;
  const getY = (val) => padding.top + drawHeight - ((val - minVal) / range) * drawHeight;

  const baselineY = getY(0);

  const linePoints = data.map((d, i) => `${getX(i)},${getY(d.cumulativeSavings)}`).join(' ');

  const areaPath = [
    `M ${getX(0)},${baselineY}`,
    ...data.map((d, i) => `L ${getX(i)},${getY(d.cumulativeSavings)}`),
    `L ${getX(data.length - 1)},${baselineY}`,
    'Z'
  ].join(' ');

  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = minVal + (range / ySteps) * (ySteps - i);
    return { val, y: padding.top + (drawHeight / ySteps) * i };
  });

  const fmt = (n) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)}k`;
    return `${sign}${abs}`;
  };

  const lastPoint = data[data.length - 1];
  const lastPositive = lastPoint.cumulativeSavings >= 0;

  return (
    <View>
      <Svg width={chartWidth} height={height}>
        <Defs>
          <LinearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lastPositive ? '#0bda73' : '#f44336'} stopOpacity="0.25" />
            <Stop offset="1" stopColor={lastPositive ? '#0bda73' : '#f44336'} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

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

        {/* Zero baseline */}
        {minVal < 0 && maxVal > 0 && (
          <Line
            x1={padding.left} y1={baselineY}
            x2={chartWidth} y2={baselineY}
            stroke="rgba(255,255,255,0.15)" strokeWidth="1"
          />
        )}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#savingsGrad)" />

        {/* Line */}
        <Polyline
          points={linePoints}
          stroke={lastPositive ? '#0bda73' : '#f44336'}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((d, i) => (
          <Circle
            key={i}
            cx={getX(i)}
            cy={getY(d.cumulativeSavings)}
            r={data.length > 8 ? 2.5 : 4}
            fill={d.cumulativeSavings >= 0 ? '#0bda73' : '#f44336'}
            stroke={COLORS.card}
            strokeWidth="1.5"
          />
        ))}

        {/* X labels */}
        {data.map((d, i) => {
          if (i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) {
            return (
              <SvgText
                key={i} x={getX(i)}
                y={padding.top + drawHeight + 16}
                fontSize="9" fill={COLORS.textSecondary} textAnchor="middle"
              >
                {d.month}
              </SvgText>
            );
          }
          return null;
        })}
      </Svg>

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <View style={[styles.dot, { backgroundColor: '#0bda73' }]} />
          <Text style={styles.footerText}>Positive savings</Text>
        </View>
        <View style={styles.footerItem}>
          <View style={[styles.dot, { backgroundColor: '#f44336' }]} />
          <Text style={styles.footerText}>Deficit</Text>
        </View>
      </View>
    </View>
  );
};

const makeStyles = (COLORS) => StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10, height: 10, borderRadius: 5,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});

export default SavingsAreaChart;
