import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Svg, Circle, G, Text as SvgText } from 'react-native-svg';
import { formatAmount } from '../../utils/formatters';
import { useProfile } from '../../context/ProfileContext';
import { useTheme } from '../../context/ThemeContext';

const DonutChart = ({ data, expenseChange, monthlySpend }) => {
  const { currency } = useProfile();
  const { colors: COLORS } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const radius = 55;
  const strokeWidth = 22;
  const centerX = 80;
  const centerY = 80;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  const isEmpty = !data || !data.length;
  const chartData = isEmpty
    ? [{ name: 'No Expenses', amount: 0, percent: 100, color: COLORS.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]
    : data;

  return (
    <View style={{
      marginVertical: 16,
      backgroundColor: COLORS.glass,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.glassBorder,
      padding: 16,
    }}>
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        alignItems: 'flex-start',
        paddingHorizontal: 4
      }}>
        <View>
          <Text style={{ color: COLORS.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>This Month</Text>
          <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: 'bold', marginTop: 1 }}>
            {currency} {monthlySpend ? monthlySpend.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
          </Text>
        </View>

        {expenseChange !== undefined && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>vs past month</Text>
            <Text style={{
              color: expenseChange <= 0 ? COLORS.accent : COLORS.error,
              fontSize: 16,
              fontWeight: 'bold',
              marginTop: 1
            }}>
              {expenseChange > 0 ? '+' : ''}{expenseChange.toFixed(1)}%
            </Text>
          </View>
        )}
      </View>

      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Svg height="180" width="180" viewBox="0 0 160 160">
          <G rotation="-90" origin="80, 80">
            {chartData.map((item, index) => {
              const dashLength = (item.percent / 100) * circumference;
              const dashOffset = currentOffset;
              currentOffset -= dashLength;

              return (
                <Circle
                  key={index}
                  cx={centerX}
                  cy={centerY}
                  r={radius}
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={`${dashLength} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  onPress={() => setSelectedCategory(item)}
                />
              );
            })}
          </G>
          <G pointerEvents="none">
            <SvgText x="80" y="76" fill={COLORS.text} fontSize="13" fontWeight="bold" textAnchor="middle">Expense</SvgText>
            <SvgText x="80" y="92" fill={COLORS.textSecondary} fontSize="10" textAnchor="middle">Breakdown</SvgText>
          </G>
        </Svg>
      </View>

      {!isEmpty && (
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 12,
          marginTop: 18,
          paddingHorizontal: 8
        }}>
          {chartData.slice(0, 6).map((item, idx) => (
          <Pressable
            key={idx}
            style={{ flexDirection: 'row', alignItems: 'center', minWidth: '28%' }}
            onPress={() => setSelectedCategory(item)}
          >
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: item.color, marginRight: 6 }} />
            <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '500' }} numberOfLines={1}>{item.name}</Text>
          </Pressable>
        ))}
      </View>
      )}

      {selectedCategory && (
        <View style={{
          marginTop: 16,
          marginHorizontal: 8,
          alignItems: 'center',
          backgroundColor: COLORS.glassStrong,
          padding: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: COLORS.glassBorder,
        }}>
          <Text style={{ color: selectedCategory.color, fontSize: 15, fontWeight: 'bold' }}>{selectedCategory.name}</Text>
          <Text style={{ color: COLORS.text, fontSize: 13, marginTop: 2 }}>
            {currency} {formatAmount(selectedCategory.amount)}  •  {selectedCategory.percent.toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );
};

export default DonutChart;
