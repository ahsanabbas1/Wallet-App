import React from 'react';
import { Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export default function HeaderPlusButton({ onPress, size = 20 }) {
  const { colors: COLORS } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: pressed
          ? COLORS.primary + '44'
          : COLORS.primary + '22',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Plus color={COLORS.primary} size={size} />
    </Pressable>
  );
}
