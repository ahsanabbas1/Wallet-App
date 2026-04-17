import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Svg, Circle, G, Text as SvgText } from 'react-native-svg';
import { COLORS } from '../../constants/theme';
import { formatAmount } from '../../utils/formatters';

const DonutChart = ({ data, expenseChange, monthlySpend }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const radius = 85; // Increased radius
  const strokeWidth = 38; // Increased stroke width
  const centerX = 110;
  const centerY = 110;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  if (!data || !data.length) return (
    <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: COLORS.textSecondary }}>No data for this period</Text>
    </View>
  );

  return (
    <View style={{ marginVertical: 20 }}>
      {/* Integrated Header with Summary and Comparison */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        paddingHorizontal: 16, 
        marginBottom: 20,
        alignItems: 'flex-start'
      }}>
        {/* Top Left: This Month */}
        <View>
          <Text style={{ color: COLORS.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>This Month</Text>
          <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: 'bold', marginTop: 2 }}>
            PKR: {monthlySpend ? monthlySpend.toLocaleString() : '0'}
          </Text>
        </View>

        {/* Top Right: vs Past Month */}
        {expenseChange !== undefined && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>vs past month</Text>
            <Text style={{ 
              color: expenseChange <= 0 ? COLORS.accent : COLORS.error, 
              fontSize: 18, 
              fontWeight: 'bold',
              marginTop: 2 
            }}>
              {expenseChange > 0 ? '+' : ''}{expenseChange.toFixed(1)}%
            </Text>
          </View>
        )}
      </View>



      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Svg height="240" width="240" viewBox="0 0 220 220">
          <G rotation="-90" origin="110, 110">
            {data.map((item, index) => {
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
            <SvgText x="110" y="105" fill={COLORS.text} fontSize="16" fontWeight="bold" textAnchor="middle">Expense</SvgText>
            <SvgText x="110" y="125" fill={COLORS.textSecondary} fontSize="12" textAnchor="middle">Breakdown</SvgText>
          </G>
        </Svg>
      </View>

      {/* Legend at the bottom */}
      <View style={{ 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        justifyContent: 'center', 
        gap: 16, 
        marginTop: 24,
        paddingHorizontal: 20 
      }}>
        {data.slice(0, 6).map((item, idx) => (
          <Pressable 
            key={idx} 
            style={{ flexDirection: 'row', alignItems: 'center', minWidth: '30%' }}
            onPress={() => setSelectedCategory(item)}
          >
            <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: item.color, marginRight: 8 }} />
            <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{item.name}</Text>
          </Pressable>
        ))}
      </View>

      {selectedCategory && (
        <View style={{ 
          marginTop: 24, 
          marginHorizontal: 30, 
          alignItems: 'center', 
          backgroundColor: 'rgba(255,255,255,0.05)', 
          padding: 16, 
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)'
        }}>
          <Text style={{ color: selectedCategory.color, fontSize: 18, fontWeight: 'bold' }}>{selectedCategory.name}</Text>
          <Text style={{ color: COLORS.text, fontSize: 16, marginTop: 4 }}>
            PKR {formatAmount(selectedCategory.amount)}  •  {selectedCategory.percent.toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );
};


export default DonutChart;
