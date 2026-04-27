import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { Svg, Polyline, Circle, G, Text as SvgText, Line } from 'react-native-svg';
import { useProfile } from '../../context/ProfileContext';
import { useTheme } from '../../context/ThemeContext';

const LineChart = ({ data, label, color, height = 250 }) => {
  const { currency } = useProfile();
  const { colors: COLORS } = useTheme();
  const lineColor = color || COLORS.primary;
  const { width } = Dimensions.get('window');
  const chartWidth = width - 40;
  const chartHeight = height - 80;
  const padding = 40;

  if (!data || data.length === 0) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: COLORS.textSecondary }}>No data available</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map(d => d.amount || 0));
  const minValue = 0;
  const range = maxValue - minValue || 1;

  // Calculate points for the polyline
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1 || 1)) * chartWidth + padding;
    const y = chartHeight - ((item.amount - minValue) / range) * chartHeight + 20;
    return `${x},${y}`;
  }).join(' ');

  // Calculate points for the area (fill)
  const areaPoints = [
    `${padding},${chartHeight + 20}`,
    ...data.map((item, index) => {
      const x = (index / (data.length - 1 || 1)) * chartWidth + padding;
      const y = chartHeight - ((item.amount - minValue) / range) * chartHeight + 20;
      return `${x},${y}`;
    }),
    `${padding + chartWidth},${chartHeight + 20}`,
  ].join(' ');

  // Y-axis labels
  const yAxisSteps = 4;
  const yAxisLabels = [];
  for (let i = 0; i <= yAxisSteps; i++) {
    const value = (range / yAxisSteps) * i;
    yAxisLabels.push({
      label: `${currency} ${(maxValue - value).toFixed(0)}`,
      y: 20 + (chartHeight / yAxisSteps) * i
    });
  }

  return (
    <View style={{ marginVertical: 16, marginHorizontal: 20 }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 16 }}>
        {label}
      </Text>

      <Svg height={height} width={width - 40} viewBox={`0 0 ${width - 40} ${height}`}>
        {/* Grid lines */}
        {yAxisLabels.map((item, index) => (
          <Line
            key={`grid-${index}`}
            x1={padding}
            y1={item.y}
            x2={padding + chartWidth}
            y2={item.y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
            strokeDasharray="5,5"
          />
        ))}

        {/* Y-axis labels */}
        {yAxisLabels.slice(0, 3).map((item, index) => (
          <SvgText
            key={`label-${index}`}
            x="5"
            y={item.y + 4}
            fontSize="10"
            fill={COLORS.textSecondary}
          >
            {item.label}
          </SvgText>
        ))}

        {/* Area under line */}
        <Polyline
          points={areaPoints}
          fill={lineColor}
          fillOpacity="0.1"
          stroke="none"
        />

        {/* Line */}
        <Polyline
          points={points}
          stroke={lineColor}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((item, index) => {
          const x = (index / (data.length - 1 || 1)) * chartWidth + padding;
          const y = chartHeight - ((item.amount - minValue) / range) * chartHeight + 20;
          return (
            <Circle
              key={`point-${index}`}
              cx={x}
              cy={y}
              r="4"
              fill={lineColor}
              stroke={COLORS.card}
              strokeWidth="2"
            />
          );
        })}

        {/* X-axis labels */}
        {data.map((item, index) => {
          if (index % Math.ceil(data.length / 5) === 0 || index === data.length - 1) {
            const x = (index / (data.length - 1 || 1)) * chartWidth + padding;
            return (
              <SvgText
                key={`x-label-${index}`}
                x={x}
                y={chartHeight + 35}
                fontSize="10"
                fill={COLORS.textSecondary}
                textAnchor="middle"
              >
                {item.label}
              </SvgText>
            );
          }
          return null;
        })}
      </Svg>

      {/* Legend */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, justifyContent: 'center' }}>
        <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: lineColor, marginRight: 8 }} />
        <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '500' }}>Trend</Text>
      </View>
    </View>
  );
};

export default LineChart;
