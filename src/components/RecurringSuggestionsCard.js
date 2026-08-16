import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Repeat, Plus, X } from 'lucide-react-native';
import { useProfile } from '../context/ProfileContext';
import { useTheme } from '../context/ThemeContext';

const FREQUENCY_LABELS = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

const RecurringSuggestionsCard = ({ suggestions, onAdd, onDismiss }) => {
  const { currency } = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [busySignature, setBusySignature] = useState(null);

  if (!suggestions || suggestions.length === 0) return null;

  const handleAdd = async (item) => {
    setBusySignature(item.signature);
    try {
      await onAdd(item);
    } finally {
      setBusySignature(null);
    }
  };

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={styles.sectionHeader}>
        <Repeat color={COLORS.primary} size={16} />
        <Text style={styles.sectionTitle}>Looks Recurring</Text>
      </View>

      {suggestions.map((item) => {
        const isIncome = item.type === 'income';
        const busy = busySignature === item.signature;
        return (
          <View key={item.signature} style={styles.card}>
            <View style={styles.header}>
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {item.categoryName} · {FREQUENCY_LABELS[item.frequency]} · seen {item.occurrences}x
                </Text>
              </View>
              <Text style={[styles.amount, { color: isIncome ? COLORS.success : COLORS.text }]}>
                {isIncome ? '+' : '-'}{currency} {item.amount.toLocaleString()}
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => onDismiss(item)} style={styles.dismissButton} disabled={busy}>
                <X color={COLORS.textSecondary} size={16} />
                <Text style={styles.dismissText}>Dismiss</Text>
              </Pressable>
              <Pressable onPress={() => handleAdd(item)} style={styles.addButton} disabled={busy}>
                {busy ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Plus color={COLORS.primary} size={16} />
                    <Text style={styles.addText}>Add to Planned</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const makeStyles = (COLORS) => StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.glass,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  sub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.glassBorder,
    marginTop: 12,
    paddingTop: 12,
  },
  dismissButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dismissText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '18',
  },
  addText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});

export default RecurringSuggestionsCard;
