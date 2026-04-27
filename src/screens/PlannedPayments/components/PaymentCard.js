import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CalendarClock, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useProfile } from '../../../context/ProfileContext';

const PaymentCard = ({ item, onDelete }) => {
  const { colors: COLORS } = useTheme();
  const { currency } = useProfile();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const isIncome = item.type === 'income';

  return (
    <View style={styles.paymentCard}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: isIncome ? COLORS.success + '22' : COLORS.error + '22' }]}>
          <CalendarClock color={isIncome ? COLORS.success : COLORS.error} size={20} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSub}>
            {item.frequency.toUpperCase()} • Next: {new Date(item.next_date).toLocaleDateString()}
          </Text>
        </View>
        <Text style={[styles.cardAmount, { color: isIncome ? COLORS.success : COLORS.text }]}>
          {isIncome ? '+' : '-'}{currency} {parseFloat(item.amount || 0).toLocaleString()}
        </Text>
      </View>
      <View style={styles.cardActions}>
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
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  cardSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  cardAmount: { fontSize: 16, fontWeight: '700' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: COLORS.divider, marginTop: 12, paddingTop: 12 },
  deleteButton: { padding: 4 },
});

export default PaymentCard;
