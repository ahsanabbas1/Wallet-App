import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { ArrowUpRight, ArrowDownLeft, Calendar, Filter, Plus, ReceiptText, Pencil, Trash2, Menu, Search, X } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import styles from './styles';
import { TextInput } from 'react-native';

const formatAmount = (amount) => {
  const num = parseFloat(amount || 0);
  if (num >= 10000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 100000) return (num / 1000).toFixed(0) + 'k';
  if (num >= 10000) return (num / 1000).toFixed(1) + 'k';
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const ExpenseTracker = ({ navigation }) => {
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [filterPeriod, setFilterPeriod] = useState('1M'); 
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const filterOptions = [
    { label: 'Today', value: 'TODAY' },
    { label: 'Past 1 Week', value: '1W' },
    { label: 'Last 1 Month', value: '1M' },
    { label: '6 Months', value: '6M' },
    { label: '1 Year', value: '1Y' },
    { label: 'Custom Range', value: 'CUSTOM' },
    { label: 'All Records', value: 'ALL' },
  ];

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      if (!userId) return;

      let query = supabase
        .from('transactions')
        .select(`
          *,
          categories (
            name,
            color,
            icon
          )
        `)
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (filterPeriod !== 'ALL') {
        const now = new Date();
        let startDate = new Date();
        if (filterPeriod === 'TODAY') startDate.setHours(0, 0, 0, 0);
        else if (filterPeriod === '1W') startDate.setDate(now.getDate() - 7);
        else if (filterPeriod === '1M') startDate.setMonth(now.getMonth() - 1);
        else if (filterPeriod === '6M') startDate.setMonth(now.getMonth() - 6);
        else if (filterPeriod === '1Y') startDate.setFullYear(now.getFullYear() - 1);
        else if (filterPeriod === 'CUSTOM' && customStartDate) {
          startDate = new Date(customStartDate);
        }
        
        if (filterPeriod !== 'CUSTOM' || (filterPeriod === 'CUSTOM' && customStartDate)) {
          query = query.gte('date', startDate.toISOString());
        }

        if (filterPeriod === 'CUSTOM' && customEndDate) {
          const endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
          query = query.lte('date', endDate.toISOString());
        }
      }

      const { data, error } = await query;

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

  const handleDeleteTransaction = (transaction) => {
    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to delete "${transaction.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', transaction.id);
              if (error) throw error;
              fetchTransactions();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [filterPeriod])
  );

  // Group transactions by date and filter by search
  const filteredTransactions = transactions.filter(t => {
    const searchLower = searchText.toLowerCase();
    return (
      t.title.toLowerCase().includes(searchLower) ||
      (t.description && t.description.toLowerCase().includes(searchLower)) ||
      (t.categories?.name && t.categories.name.toLowerCase().includes(searchLower))
    );
  });

  const groupedTransactions = filteredTransactions.reduce((groups, transaction) => {
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            style={[styles.iconButton, { marginRight: 16 }]}
            onPress={openDrawer}
          >
            <Menu color={COLORS.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Financial Ledger</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('AddTransaction')}
          >
            <Plus color={COLORS.text} size={20} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setShowSearch(!showSearch)}
          >
            {showSearch ? <X color={COLORS.text} size={20} /> : <Search color={COLORS.text} size={20} />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Filter color={COLORS.text} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {showSearch && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <TextInput
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 8,
              padding: 10,
              color: COLORS.text,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)'
            }}
            placeholder="Search by category, note or title..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
          />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                <ArrowDownLeft color={COLORS.accent} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>PKR {formatAmount(totals.income)}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <ArrowUpRight color={COLORS.error} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>Expenses</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>PKR {formatAmount(totals.expense)}</Text>
              </View>
            </View>
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
                  amount={item.amount} // Pass raw amount to LedgerItem
                  color={item.categories?.color || COLORS.primary}
                  isPositive={item.type === 'income'}
                  onEdit={() => navigation.navigate('AddTransaction', { transaction: item })}
                  onDelete={() => handleDeleteTransaction(item)}
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

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter by Date</Text>
            {filterPeriod === 'CUSTOM' && (
              <View style={{ marginBottom: 15 }}>
                <Text style={{ color: COLORS.textSecondary, marginBottom: 5, fontSize: 12 }}>Start Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={{ backgroundColor: COLORS.background, color: COLORS.text, padding: 8, borderRadius: 4, marginBottom: 10 }}
                  placeholder="2024-01-01"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={customStartDate}
                  onChangeText={setCustomStartDate}
                />
                <Text style={{ color: COLORS.textSecondary, marginBottom: 5, fontSize: 12 }}>End Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={{ backgroundColor: COLORS.background, color: COLORS.text, padding: 8, borderRadius: 4, marginBottom: 10 }}
                  placeholder="2024-12-31"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={customEndDate}
                  onChangeText={setCustomEndDate}
                />
                <TouchableOpacity
                  style={{ backgroundColor: COLORS.primary, padding: 10, borderRadius: 4, alignItems: 'center' }}
                  onPress={() => {
                    fetchTransactions();
                    setShowFilterModal(false);
                  }}
                >
                  <Text style={{ color: COLORS.text, fontWeight: 'bold' }}>Apply Custom Filter</Text>
                </TouchableOpacity>
              </View>
            )}
            {filterOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.filterOption}
                onPress={() => {
                  setFilterPeriod(option.value);
                  setShowFilterModal(false);
                }}
              >
                <Text style={[
                  styles.filterOptionText,
                  filterPeriod === option.value && styles.filterOptionActive
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const LedgerItem = ({ icon: Icon, title, sub, amount, color, isPositive, onEdit, onDelete }) => (
  <View style={styles.ledgerItem}>
    <View style={[styles.ledgerIcon, { backgroundColor: color + '20' }]}>
      <Icon color={color} size={24} />
    </View>
    <View style={styles.ledgerDetails}>
      <Text style={styles.ledgerTitle} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
      <Text style={styles.ledgerSub} numberOfLines={1} ellipsizeMode="tail">{sub}</Text>
    </View>
    <View style={styles.ledgerRight}>
      <Text style={[styles.ledgerAmount, isPositive && { color: COLORS.accent }]}>
        {isPositive ? '+' : '-'}PKR {formatAmount(amount)}
      </Text>
      <View style={styles.actionButtons}>
        <TouchableOpacity onPress={onEdit} style={styles.pencilButton}>
          <Pencil color={COLORS.textSecondary} size={16} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
          <Trash2 color={COLORS.error} size={16} />
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

export default ExpenseTracker;
