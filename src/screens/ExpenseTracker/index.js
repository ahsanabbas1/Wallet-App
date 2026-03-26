import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { ArrowUpRight, ArrowDownLeft, Calendar, Filter, Plus, ReceiptText, Pencil } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import styles from './styles';

const ExpenseTracker = ({ navigation }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ income: 0, expense: 0 });

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          categories (
            name,
            color,
            icon
          )
        `)
        .eq('user_id', session.user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      
      const trans = data || [];
      setTransactions(trans);

      // Calculate totals
      const income = trans
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const expense = trans
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      setTotals({ income, expense });
    } catch (error) {
      console.error('Error fetching transactions:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [])
  );

  // Group transactions by date
  const groupedTransactions = transactions.reduce((groups, transaction) => {
    const date = new Date(transaction.date).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {});

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Financial Ledger</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('AddTransaction')}
          >
            <Plus color={COLORS.text} size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Filter color={COLORS.text} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { backgroundColor: COLORS.card }]}>
            <View style={[styles.summaryIcon, { backgroundColor: COLORS.accent + '20' }]}>
              <ArrowUpRight color={COLORS.accent} size={24} />
            </View>
            <Text style={styles.summaryLabel}>Total Income</Text>
            <Text style={[styles.summaryAmount, { color: COLORS.accent }]}>PKR {totals.income.toFixed(2)}</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: COLORS.card }]}>
            <View style={[styles.summaryIcon, { backgroundColor: COLORS.error + '20' }]}>
              <ArrowDownLeft color={COLORS.error} size={24} />
            </View>
            <Text style={styles.summaryLabel}>Total Expenses</Text>
            <Text style={[styles.summaryAmount, { color: COLORS.error }]}>PKR {totals.expense.toFixed(2)}</Text>
          </View>
        </View>

        {loading && transactions.length === 0 ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : Object.keys(groupedTransactions).length > 0 ? (
          Object.keys(groupedTransactions).map((date) => (
            <View key={date} style={styles.section}>
              <View style={styles.dateHeader}>
                <Calendar color={COLORS.textSecondary} size={16} />
                <Text style={styles.dateText}>{date}</Text>
              </View>

              {groupedTransactions[date].map((item) => (
                <LedgerItem 
                  key={item.id}
                  icon={ReceiptText} 
                  title={item.title} 
                  sub={item.description || item.categories?.name || 'No details'} 
                  amount={`${item.type === 'expense' ? '-' : '+'}PKR ${parseFloat(item.amount).toFixed(2)}`} 
                  color={item.categories?.color || COLORS.primary}
                  isPositive={item.type === 'income'}
                  onEdit={() => navigation.navigate('AddTransaction', { transaction: item })}
                />
              ))}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {loading ? 'Loading...' : 'No transactions found.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const LedgerItem = ({ icon: Icon, title, sub, amount, color, isPositive, onEdit }) => (
  <View style={styles.ledgerItem}>
    <View style={[styles.ledgerIcon, { backgroundColor: color + '20' }]}>
      <Icon color={color} size={24} />
    </View>
    <View style={styles.ledgerDetails}>
      <Text style={styles.ledgerTitle}>{title}</Text>
      <Text style={styles.ledgerSub} numberOfLines={1}>{sub}</Text>
    </View>
    <View style={styles.ledgerRight}>
      <Text style={[styles.ledgerAmount, isPositive && { color: COLORS.accent }]}>
        {amount}
      </Text>
      <TouchableOpacity onPress={onEdit} style={styles.pencilButton}>
        <Pencil color={COLORS.textSecondary} size={16} />
      </TouchableOpacity>
    </View>
  </View>
);

export default ExpenseTracker;
