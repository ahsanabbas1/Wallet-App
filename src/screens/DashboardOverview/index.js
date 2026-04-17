import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { 
  Target, 
  Plus, 
  Menu, 
  DollarSign, 
  LogOut, 
  ReceiptText, 
  CalendarClock 
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { supabase } from '../../lib/supabase';

// Shared Components
import TransactionItem from '../../components/TransactionItem';
import DonutChart from '../../components/Charts/DonutChart';
import GaugeChart from '../../components/Charts/GaugeChart';

// Utils & Services
import { formatAmount } from '../../utils/formatters';
import { dashboardService } from '../../services/dashboardService';
import { transactionService } from '../../services/transactionService';

import styles from './styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DashboardOverview = () => {
  const navigation = useNavigation();
  const { openDrawer } = useDrawer();
  
  const [userName, setUserName] = useState('User');
  const [loading, setLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [totals, setTotals] = useState({ balance: 0, monthlySpend: 0, totalSaved: 0, totalIncome: 0 });
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState({ balanceScore: 0, cashFlowScore: 0 });

  const loadProfile = async () => {
    try {
      const profile = await dashboardService.getUserProfile();
      if (profile) setUserName(profile.name);
    } catch (e) {
      console.warn('Profile fetch error:', e.message);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const data = await dashboardService.getDashboardData(session.user.id);
      
      setRecentTransactions(data.recentTransactions);
      setTotals(data.totals);
      setCategoryBreakdown(data.categoryBreakdown);
      setPerformanceMetrics(data.performanceMetrics);
    } catch (error) {
      console.error('Dashboard load error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadDashboardData();
    }, [])
  );

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
              // We could add this to transactionService too
              const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', transaction.id);
              if (error) throw error;
              loadDashboardData();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error', error.message);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable 
              style={[styles.iconButton, { marginRight: 16 }]}
              onPress={openDrawer}
            >
              <Menu color={COLORS.text} size={24} />
            </Pressable>
            <View>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.userName}>{userName}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Pressable style={styles.iconButton} onPress={handleSignOut}>
              <LogOut color={COLORS.error} size={24} />
            </Pressable>
          </View>
        </View>

        {/* Cash & Spend Cards */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
          <View style={[styles.balanceCard, { flex: 1, marginRight: 8, marginBottom: 0, padding: 20 }]}>
            <Text style={styles.balanceLabel}>Cash in PKR</Text>
            <Text style={[styles.balanceAmount, { fontSize: SCREEN_WIDTH * 0.06 }]} numberOfLines={1} adjustsFontSizeToFit>
              PKR {formatAmount(totals.balance)}
            </Text>
          </View>
          <View style={[styles.balanceCard, { flex: 1, marginLeft: 8, marginBottom: 0, padding: 20, backgroundColor: COLORS.accent }]}>
            <Text style={styles.balanceLabel}>Monthly Spend</Text>
            <Text style={[styles.balanceAmount, { fontSize: SCREEN_WIDTH * 0.06 }]} numberOfLines={1} adjustsFontSizeToFit>
              PKR {formatAmount(totals.monthlySpend)}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActions}>
          <Pressable 
            style={styles.actionItem}
            onPress={() => navigation.navigate('AddTransaction')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.primary }]}>
              <Plus color={COLORS.text} size={24} />
            </View>
            <Text style={styles.actionText}>Add</Text>
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => navigation.navigate('Expenses')}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.accent }]}>
              <DollarSign color={COLORS.text} size={24} />
            </View>
            <Text style={styles.actionText}>Ledger</Text>
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => navigation.navigate('Savings Goals')}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.warning }]}>
              <Target color={COLORS.text} size={24} />
            </View>
            <Text style={styles.actionText}>Goal</Text>
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => navigation.navigate('Planned')}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.card }]}>
              <CalendarClock color={COLORS.primary} size={24} />
            </View>
            <Text style={styles.actionText}>Planned</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Expense Structure</Text>
        </View>
        <DonutChart data={categoryBreakdown} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Pressable onPress={() => navigation.navigate('Expenses')}>
            <Text style={styles.seeAllText}>See All</Text>
          </Pressable>
        </View>

        <View style={styles.transactionsList}>
          {loading ? (
             <ActivityIndicator color={COLORS.primary} />
          ) : recentTransactions.length > 0 ? (
            recentTransactions.map((item) => (
              <TransactionItem 
                key={item.id}
                icon={ReceiptText} 
                title={item.title} 
                category={item.categories?.name || 'Uncategorized'} 
                time={new Date(item.date).toLocaleDateString() + ' ' + new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                amount={`${item.type === 'expense' ? '-' : '+'}PKR ${parseFloat(item.amount).toFixed(2)}`} 
                method={item.description || 'No note'}
                color={item.categories?.color || COLORS.primary}
                isPositive={item.type === 'income'}
                onEdit={() => navigation.navigate('AddTransaction', { transaction: item })}
                onDelete={() => handleDeleteTransaction(item)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No recent transactions found.</Text>
            </View>
          )}
        </View>

        {/* Insights Section */}
        <View style={{ marginTop: 30, padding: 16, backgroundColor: COLORS.card, borderRadius: 24, marginBottom: 40 }}>
          <View style={{ marginBottom: 20 }}>
             <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: 'bold' }}>Wallet Insights</Text>
             <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>
                Past 30 days performance and outlook for next 7 days
             </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
             <GaugeChart score={performanceMetrics.balanceScore} label="Balance Pred." />
             <GaugeChart score={performanceMetrics.cashFlowScore} label="Cash-Flow Pred." />
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
             <GaugeChart score={totals.balance > 0 ? 85 : 15} label="Outlook" />
             <GaugeChart score={Math.min((totals.monthlySpend / (totals.totalIncome || 1)) * 100, 100)} label="Spendings" />
             <GaugeChart score={Math.min((totals.totalIncome / 100000) * 100, 100)} label="Credit" />
             <GaugeChart score={Math.min((totals.monthlySpend / 100000) * 100, 100)} label="Debit" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default DashboardOverview;

