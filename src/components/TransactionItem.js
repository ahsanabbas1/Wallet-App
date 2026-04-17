import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Tag, Pencil, Trash2 } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { formatAmount } from '../utils/formatters';

const TransactionItem = ({ 
  icon: Icon, 
  title, 
  category, 
  time, 
  amount, 
  method, 
  color, 
  isPositive, 
  onEdit, 
  onDelete 
}) => {
  // Extract number from amount string if it's passed as a string like "-PKR 1000"
  let displayAmount = amount;
  if (typeof amount === 'string') {
    const rawNum = parseFloat(amount.replace(/[^0-9.-]/g, ''));
    if (!isNaN(rawNum) && rawNum > 1000000) {
      displayAmount = (isPositive ? '+' : '-') + 'PKR ' + formatAmount(rawNum);
    }
  }

  return (
    <View style={styles.transactionItem}>
      <View style={[styles.transactionIcon, { backgroundColor: color + '20' }]}>
        <Icon color={color} size={24} />
      </View>
      <View style={styles.transactionDetails}>
        <Text style={styles.transactionTitle}>{title}</Text>
        <Text style={styles.transactionSub}>{category} • {time}</Text>
      </View>
      <View style={[styles.transactionAmountContainer, { maxWidth: '30%' }]}>
        <Text 
          style={[styles.transactionAmount, isPositive && { color: COLORS.accent }]} 
          numberOfLines={1} 
          adjustsFontSizeToFit
        >
          {displayAmount}
        </Text>
        <Pressable onPress={onEdit} style={styles.noteIndicator}>
          <Tag color={COLORS.textSecondary} size={14} style={{ marginRight: 4 }} />
          <Text style={styles.transactionMethod} numberOfLines={1} ellipsizeMode="tail">{method}</Text>
        </Pressable>
      </View>
      <View style={styles.actionButtons}>
        <Pressable onPress={onEdit} style={styles.pencilIcon}>
          <Pencil color={COLORS.textSecondary} size={20} />
        </Pressable>
        <Pressable onPress={onDelete} style={styles.deleteIcon}>
          <Trash2 color={COLORS.error} size={20} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionDetails: {
    flex: 1,
    marginLeft: 16,
  },
  transactionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  transactionAmount: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  noteIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  transactionMethod: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pencilIcon: {
    padding: 4,
  },
  deleteIcon: {
    padding: 4,
  },
});

export default TransactionItem;
