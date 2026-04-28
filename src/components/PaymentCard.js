import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CalendarClock, CheckCircle2, Trash2 } from 'lucide-react-native';
import { useProfile } from '../context/ProfileContext';
import { useTheme } from '../context/ThemeContext';
import { paymentService } from '../services/paymentService';

const PaymentCard = ({ item, onDelete, onRecord }) => {
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
          <Text style={styles.cardSub}>
            {paymentService.getFrequencyLabel(item.frequency)} • Next: {item.next_date ? paymentService.parseLocalDate(item.next_date).toLocaleDateString() : 'No date'}
          </Text>
        </View>
        <Text style={[styles.cardAmount, { color: isIncome ? COLORS.success || '#4caf50' : COLORS.text }]}>
          {isIncome ? '+' : '-'}{currency} {parseFloat(item.amount || 0).toLocaleString()}
        </Text>
      </View>
      <View style={styles.cardActions}>
        {onRecord ? (
          <Pressable onPress={() => onRecord(item)} style={styles.recordButton}>
            <CheckCircle2 color={COLORS.success || '#4caf50'} size={18} />
            <Text style={[styles.recordButtonText, { color: COLORS.success || '#4caf50' }]}>Record Now</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => onDelete(item.id)} style={styles.deleteButton}>
          <Trash2 color={COLORS.error} size={18} />
        </Pressable>
      </View>
    </View>
  );
};

const makeStyles = (COLORS) => StyleSheet.create({
  paymentCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
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
