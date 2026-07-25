import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING } from '../constants/theme';

const StatSummaryCard = ({
  icon: Icon,
  label,
  value,
  meta,
  progress,
  progressColor,
  accentColor,
  onPress,
  style,
}) => {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const tint = accentColor || COLORS.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: tint + '30', opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      <View style={styles.headerRow}>
        {Icon ? (
          <View style={[styles.iconWrap, { backgroundColor: tint + '18' }]}>
            <Icon color={tint} size={14} />
          </View>
        ) : null}
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>

      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {meta ? <Text style={[styles.meta, { color: progressColor || COLORS.textSecondary }]} numberOfLines={1}>{meta}</Text> : null}

      {progress != null && (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(Math.max(progress, 0), 1) * 100}%`, backgroundColor: progressColor || tint }]} />
        </View>
      )}
    </Pressable>
  );
};

const makeStyles = (COLORS) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.glass,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    shadowColor: COLORS.isDark ? '#000' : COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: COLORS.isDark ? 0.2 : 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
  },
  value: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  meta: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.glassLight,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});

export default StatSummaryCard;
