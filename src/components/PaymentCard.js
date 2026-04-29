import React, { useMemo, memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CalendarClock, CheckCircle2, Trash2, Pencil } from 'lucide-react-native';
import { useProfile } from '../context/ProfileContext';
import { useTheme } from '../context/ThemeContext';
import { paymentService } from '../services/paymentService';

const PaymentCard = memo(({ item, onDelete, onRecord, onEdit }) => {
  const { currency } = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const isIncome = item.type === 'income';
  
  return (
    <View style={styles.paymentCard}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: isIncome ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)' }]}>
          <CalendarClock color={isIncome ? COLORS.success || '#4caf50' : COLORS.error} size={20} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {paymentService.getFrequencyLabel(item.frequency)}
            {item.next_date ? ` · Next: ${paymentService.parseLocalDate(item.next_date)?.toLocaleDateString()}` : ''}
          </Text>
          {(item.start_date || item.end_date) && (
            <Text style={[styles.cardSub, { marginTop: 2, fontSize: 11 }]} numberOfLines={1}>
              {item.start_date ? `From ${paymentService.parseLocalDate(item.start_date)?.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
              {item.start_date && item.end_date ? '  →  ' : ''}
              {item.end_date ? `Until ${paymentService.parseLocalDate(item.end_date)?.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
            </Text>
          )}
        </View>
        <Text style={[styles.cardAmount, { color: isIncome ? COLORS.success || '#4caf50' : COLORS.text }]}>
          {isIncome ? '+' : '-'}{currency} {parseFloat(item.amount || 0).toLocaleString()}
        </Text>
      </View>
      <View style={styles.cardActions}>
        {onRecord ? (
          <Pressable onPress={() => onRecord(item)} style={styles.recordButton}>
            <CheckCircle2 color={COLORS.success} size={18} />
            <Text style={[styles.recordButtonText, { color: COLORS.success }]}>Record Now</Text>
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onEdit && (
            <Pressable
              onPress={() => onEdit(item)}
              style={[styles.deleteButton, { backgroundColor: COLORS.surface }]}
            >
              <Pencil color={COLORS.textSecondary} size={16} />
            </Pressable>
          )}
          <Pressable onPress={() => onDelete(item.id)} style={styles.deleteButton}>
            <Trash2 color={COLORS.error} size={18} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const makeStyles = (COLORS) => StyleSheet.create({
  paymentCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  cardSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    marginTop: 12,
    paddingTop: 12,
  },
  deleteButton: {
    padding: 4,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 14,
    padding: 4,
  },
  recordButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default PaymentCard;
