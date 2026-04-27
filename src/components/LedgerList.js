import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { useProfile } from '../context/ProfileContext';
import { useTheme } from '../context/ThemeContext';

const fmt = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

const TransactionCard = ({ item }) => {
  const { currency } = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const isIncome = item.type === 'income';
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: isIncome ? 'rgba(11,218,115,0.12)' : 'rgba(244,67,54,0.12)' }]}>
        {isIncome
          ? <ArrowDownLeft color="#0bda73" size={18} />
          : <ArrowUpRight color="#f44336" size={18} />}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.description}</Text>
        <Text style={styles.cardMeta}>{item.category} · {item.date}</Text>
      </View>
      <Text style={[styles.cardAmount, { color: isIncome ? '#0bda73' : '#f44336' }]}>
        {isIncome ? '+' : '-'} {currency} {fmt(isIncome ? item.income : item.expense)}
      </Text>
    </View>
  );
};

const DateGroup = ({ dateStr, items }) => {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <View style={styles.group}>
      <Text style={styles.dateLabel}>{dateStr}</Text>
      {items.map((item, i) => <TransactionCard key={item.id || i} item={item} />)}
    </View>
  );
};

const LedgerList = ({ transactions = [], summary = {} }) => {
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

  // Group by date
  const grouped = {};
  transactions.forEach(t => {
    const key = t.date;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  return (
    <View>
      {/* Summary strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryValue, { color: '#0bda73' }]}>
            {currency} {fmt(summary.totalIncome || 0)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Expense</Text>
          <Text style={[styles.summaryValue, { color: '#f44336' }]}>
            {currency} {fmt(summary.totalExpense || 0)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Net</Text>
          <Text style={[styles.summaryValue, { color: (summary.netFlow || 0) >= 0 ? '#0bda73' : '#f44336' }]}>
            {currency} {((summary.netFlow || 0) >= 0 ? '+' : '')}{fmt(summary.netFlow || 0)}
          </Text>
        </View>
      </View>

      {/* Grouped list */}
      {Object.entries(grouped).map(([date, items]) => (
        <DateGroup key={date} dateStr={date} items={items} />
      ))}
    </View>
  );
};

const makeStyles = (COLORS) => StyleSheet.create({
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(64,81,181,0.12)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: {
    width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.07)',
  },
  summaryLabel: {
    color: COLORS.textSecondary, fontSize: 10,
    marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  summaryValue: { fontSize: 13, fontWeight: '700' },
  group: { marginBottom: 16 },
  dateLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  cardTitle: { color: COLORS.text, fontSize: 14, fontWeight: '500', marginBottom: 3 },
  cardMeta: { color: COLORS.textSecondary, fontSize: 11 },
  cardAmount: { fontSize: 14, fontWeight: '700' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 13 },
});

export default LedgerList;
