import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useProfile } from '../context/ProfileContext';
import { useTheme } from '../context/ThemeContext';

const fmt = (n) => (Number(n) || 0) > 0 ? (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';
const fmtBal = (n) => (n >= 0 ? '+' : '') + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

const LedgerTable = ({ transactions = [], summary = {} }) => {
  const { currency } = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  if (!transactions.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No transactions for this period.</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Summary strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Income</Text>
          <Text style={[styles.summaryValue, { color: '#0bda73' }]}>
            {currency} {fmt(summary.totalIncome || 0)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Expense</Text>
          <Text style={[styles.summaryValue, { color: '#f44336' }]}>
            {currency} {fmt(summary.totalExpense || 0)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Net Flow</Text>
          <Text style={[styles.summaryValue, { color: (summary.netFlow || 0) >= 0 ? '#0bda73' : '#f44336' }]}>
            {currency} {fmtBal(summary.netFlow || 0)}
          </Text>
        </View>
      </View>

      {/* Scrollable table */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Column headers */}
          <View style={styles.headerRow}>
            <Text style={[styles.hCell, { width: 90 }]}>Date</Text>
            <Text style={[styles.hCell, { width: 120 }]}>Description</Text>
            <Text style={[styles.hCell, { width: 100 }]}>Category</Text>
            <Text style={[styles.hCell, { width: 100, textAlign: 'right' }]}>Income</Text>
            <Text style={[styles.hCell, { width: 100, textAlign: 'right' }]}>Expense</Text>
            <Text style={[styles.hCell, { width: 110, textAlign: 'right' }]}>Balance</Text>
          </View>

          {/* Data rows */}
          {transactions.map((t, i) => (
            <View
              key={t.id || i}
              style={[styles.dataRow, i % 2 === 1 && styles.altRow]}
            >
              <Text style={[styles.dCell, { width: 90 }]}>{t.date}</Text>
              <Text style={[styles.dCell, { width: 120 }]} numberOfLines={1}>{t.description}</Text>
              <View style={[styles.catCell, { width: 100 }]}>
                <View style={[styles.catDot, { backgroundColor: t.categoryColor }]} />
                <Text style={styles.catName} numberOfLines={1}>{t.category}</Text>
              </View>
              <Text style={[styles.dCell, { width: 100, textAlign: 'right', color: '#0bda73' }]}>
                {fmt(t.income)}
              </Text>
              <Text style={[styles.dCell, { width: 100, textAlign: 'right', color: '#f44336' }]}>
                {fmt(t.expense)}
              </Text>
              <Text style={[styles.dCell, {
                width: 110, textAlign: 'right', fontWeight: '600',
                color: t.runningBalance >= 0 ? '#0bda73' : '#f44336'
              }]}>
                {fmtBal(t.runningBalance)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const makeStyles = (COLORS) => StyleSheet.create({
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(64,81,181,0.12)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginBottom: 4,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    marginBottom: 2,
  },
  hCell: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dataRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  altRow: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 8,
  },
  dCell: {
    color: COLORS.text,
    fontSize: 12,
  },
  catCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  catName: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
});

export default LedgerTable;
