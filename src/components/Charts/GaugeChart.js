import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Svg, Path, G, Circle } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

const GaugeChart = ({ score, label }) => {
  const { colors: COLORS } = useTheme();
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let start = displayScore;
    const end = score;
    const duration = 1000;
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const currentScore = start + (end - start) * progress;
      setDisplayScore(currentScore);
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [score]);

  const rotation = (displayScore / 100) * 180 - 90;

  // Dynamic color based on score
  const getScoreColor = (s) => {
    if (s > 70) return COLORS.accent; // Green-ish Cyan
    if (s > 40) return COLORS.warning; // Orange
    return COLORS.error; // Red
  };

  const currentColor = getScoreColor(displayScore);

  return (
    <View style={{ alignItems: 'center', flex: 1, padding: 5 }}>
      <Svg height="80" width="100" viewBox="0 0 100 60">
         <Path 
           d="M 10 50 A 40 40 0 0 1 90 50" 
           fill="none" 
           stroke={COLORS.border} 
           strokeWidth="8" 
           strokeLinecap="round" 
         />
         {/* Background segments */}
         <Path d="M 10 50 A 40 40 0 0 1 30 18" fill="none" stroke={COLORS.error} strokeWidth="8" strokeOpacity="0.2" />
         <Path d="M 30 18 A 40 40 0 0 1 70 18" fill="none" stroke={COLORS.warning} strokeWidth="8" strokeOpacity="0.2" />
         <Path d="M 70 18 A 40 40 0 0 1 90 50" fill="none" stroke={COLORS.accent} strokeWidth="8" strokeOpacity="0.2" />
         
         {/* Active score indicator path (optional but adds flare) */}
         <G rotation={rotation} origin="50, 50">
           <Path d="M 50 50 L 50 15" stroke={currentColor} strokeWidth="3" strokeLinecap="round" />
           <Circle cx="50" cy="50" r="4" fill={currentColor} />
         </G>
      </Svg>

      <Text style={{ color: COLORS.textSecondary, fontSize: 10, marginTop: 4 }}>{label}</Text>
      <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: 'bold' }}>{displayScore.toFixed(0)}%</Text>
    </View>
  );
};

export default GaugeChart;
