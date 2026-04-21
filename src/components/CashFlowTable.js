import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';

const fmt = (n) =>
  n.toLocaleString('en-PK', { maximumFractionDigits: 0 });

const NetBadge = ({ value }) => {
  const positive = value >= 0;
  return (
    <Text style={[styles.netText, { color: positive ? '#0bda73' : '#f44336' }]}>
      {positive ? '+' : ''}
      {fmt(value)}
    </Text>
  );
};

const DayRow = ({ day }) => (
  <View style={styles.dayRow}>
    <Text style={styles.dayDate}>
      {new Date(day.date + 'T00:00:00').toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
    </Text>
    <Text style={styles.dayIncome}>{day.income > 0 ? fmt(day.income) : '—'}</Text>
    <Text style={styles.dayExpense}>{day.expense > 0 ? fmt(day.expense) : '—'}</Text>
    <NetBadge value={day.net} />
  </View>
);

const MonthRow = ({ monthData }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.monthBlock}>
      <Pressable
        style={({ pressed }) => [styles.monthRow, pressed && { opacity: 0.7 }]}
        onPress={() => setOpen(v => !v)}
      >
        <View style={styles.monthLeft}>
          {open
            ? <ChevronDown color={COLORS.primary} size={16} />
            : <ChevronRight color={COLORS.textSecondary} size={16} />}
          <Text style={styles.monthName}>{monthData.month}</Text>
        </View>
        <View style={styles.monthRight}>
          <Text style={styles.monthIncome}>{fmt(monthData.income)}</Text>
          <Text style={styles.monthExpense}>{fmt(monthData.expense)}</Text>
          <NetBadge value={monthData.net} />
        </View>
      </Pressable>

      {open && (
        <View style={styles.daysContainer}>
          <View style={styles.colHeader}>
            <Text style={[styles.colHeaderText, { flex: 1.2 }]}>Date</Text>
            <Text style={[styles.colHeaderText, { flex: 1, textAlign: 'right' }]}>In</Text>
            <Text style={[styles.colHeaderText, { flex: 1, textAlign: 'right' }]}>Out</Text>
            <Text style={[styles.colHeaderText, { flex: 1.2, textAlign: 'right' }]}>Net</Text>
          </View>
          {monthData.days.map((day, i) => <DayRow key={i} day={day} />)}
        </View>
      )}
    </View>
  );
};

const CashFlowTable = ({ data = [] }) => {
  if (!data.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No cash flow data for this period.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 2 }]}>Period</Text>
        <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>Income</Text>
        <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>Expense</Text>
        <Text style={[styles.headerCell, { flex: 1.2, textAlign: 'right' }]}>Net (PKR)</Text>
      </View>

      {data.map((m, i) => <MonthRow key={i} monthData={m} />)}

      {/* Summary footer */}
      <View style={styles.footer}>
        <Text style={styles.footerLabel}>Total</Text>
        <Text style={styles.footerIncome}>
          {fmt(data.reduce((s, m) => s + m.income, 0))}
        </Text>
        <Text style={styles.footerExpense}>
          {fmt(data.reduce((s, m) => s + m.expense, 0))}
        </Text>
        <NetBadge value={data.reduce((s, m) => s + m.net, 0)} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 32,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(64,81,181,0.15)',
  },
  headerCell: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  monthBlock: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  monthLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 2,
  },
  monthName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  monthRight: {
    flexDirection: 'row',
    flex: 3.2,
    justifyContent: 'flex-end',
    gap: 8,
  },
  monthIncome: {
    color: '#0bda73',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  monthExpense: {
    color: '#f44336',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  netText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1.2,
    textAlign: 'right',
  },
  daysContainer: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingBottom: 8,
  },
  colHeader: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  colHeaderText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  dayRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 8,
    alignItems: 'center',
  },
  dayDate: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1.2,
  },
  dayIncome: {
    color: '#0bda73',
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  dayExpense: {
    color: '#f44336',
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(64,81,181,0.08)',
    alignItems: 'center',
  },
  footerLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    flex: 2,
  },
  footerIncome: {
    color: '#0bda73',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  footerExpense: {
    color: '#f44336',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
});

export default CashFlowTable;
