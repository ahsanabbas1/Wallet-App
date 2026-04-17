import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Svg, Circle, G, Text as SvgText } from 'react-native-svg';
import { COLORS } from '../../constants/theme';
import { formatAmount } from '../../utils/formatters';

const DonutChart = ({ data }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const radius = 70;
  const strokeWidth = 32;
  const centerX = 100;
  const centerY = 100;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  if (!data || !data.length) return (
    <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: COLORS.textSecondary }}>No data for this period</Text>
    </View>
  );

  return (
    <View style={{ marginVertical: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
        <Svg height="180" width="180" viewBox="0 0 200 200">
          <G rotation="-90" origin="100, 100">
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
            <SvgText x="100" y="95" fill={COLORS.text} fontSize="14" fontWeight="bold" textAnchor="middle">Expense</SvgText>
            <SvgText x="100" y="115" fill={COLORS.textSecondary} fontSize="10" textAnchor="middle">Breakdown</SvgText>
          </G>
        </Svg>

        <View style={{ maxWidth: '40%', gap: 8 }}>
          {data.slice(0, 4).map((item, idx) => (
            <Pressable 
              key={idx} 
              style={{ flexDirection: 'row', alignItems: 'center' }}
              onPress={() => setSelectedCategory(item)}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color, marginRight: 8 }} />
              <Text style={{ color: COLORS.text, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {selectedCategory && (
        <View style={{ marginTop: 20, marginHorizontal: 20, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 16 }}>
          <Text style={{ color: selectedCategory.color, fontSize: 16, fontWeight: 'bold' }}>{selectedCategory.name}</Text>
          <Text style={{ color: COLORS.text, fontSize: 14, marginTop: 4 }}>
            PKR {formatAmount(selectedCategory.amount)} • {selectedCategory.percent.toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );
};

export default DonutChart;
