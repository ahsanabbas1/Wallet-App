import React, { useMemo } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const AppButton = ({ title, onPress, loading, disabled, style, textStyle, variant = 'primary' }) => {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const isDisabled = loading || disabled;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        isSecondary && styles.secondaryButton,
        isOutline && styles.outlineButton,
        isDisabled && { opacity: 0.4 },
        style,
        pressed && !isDisabled && { opacity: 0.8 }
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline || isSecondary ? COLORS.primary : '#fff'} />
      ) : (
        <Text style={[
          styles.text,
          isSecondary && styles.secondaryText,
          isOutline   && styles.outlineText,
          textStyle,
        ]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
};

const makeStyles = (COLORS) => StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  outlineText: {
    color: COLORS.primary,
  },
});

export default AppButton;
