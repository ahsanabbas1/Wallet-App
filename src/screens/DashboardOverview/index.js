import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { makeStyles } from './styles';
import {
  Target,
  Plus,
  Menu,
  DollarSign,
  LogOut,
  ReceiptText,
  CalendarClock,
  TrendingUp,
  Bell,
} from 'lucide-react-native';

import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { supabase } from '../../lib/supabase';

// Shared Components
import TransactionItem from '../../components/TransactionItem';
import PaymentCard from '../../components/PaymentCard';
import DonutChart from '../../components/Charts/DonutChart';
import GaugeChart from '../../components/Charts/GaugeChart';

// Utils & Services
import { formatAmount } from '../../utils/formatters';
import { dashboardService } from '../../services/dashboardService';
import { transactionService } from '../../services/transactionService';
import { generateNotifications, getUnreadCount } from '../../services/notificationService';


const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DashboardOverview = () => {
  const navigation = useNavigation();
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const { currency, name, loading: profileLoading } = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [recentPlanned, setRecentPlanned] = useState([]);
  const [totals, setTotals] = useState({ 
    totalAmount: 0, 
    incoming: 0, 
    outgoing: 0, 
    cashInHand: 0, 
    monthlySpend: 0, 
    totalSaved: 0, 
    totalIncome: 0,
    loan: { total: 0, paid: 0, remaining: 0, netRemaining: 0 }
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [expenseChange, setExpenseChange] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState({ balanceScore: 0, cashFlowScore: 0 });

  // Single load function — uses userId from context, no extra getSession() call
  const loadDashboardData = async () => {
    if (!userId) return;
    try {
      setLoading(true);

      // Fire-and-forget notification generation + unread count (non-blocking)
      generateNotifications(userId)
        .then(() => getUnreadCount(userId).then(setUnreadCount))
        .catch(() => {});

      const dashData = await dashboardService.getDashboardData(userId);


      setRecentTransactions(dashData.recentTransactions);
      setRecentPlanned(dashData.recentPlanned);
      setTotals(dashData.totals);
      setCategoryBreakdown(dashData.categoryBreakdown);
      setExpenseChange(dashData.expenseChange);
      setPerformanceMetrics(dashData.performanceMetrics);
    } catch (error) {
      console.error('Dashboard load error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [userId])
  );

  // Realtime subscriptions — one channel, three tables.
  // Transactions/payments: reload dashboard data (which also refreshes bell count).
  // Notifications only: lightweight unread-count refresh, no full reload.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`dashboard_rt_${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        () => loadDashboardData()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'planned_payments', filter: `user_id=eq.${userId}` },
        () => loadDashboardData()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => getUnreadCount(userId).then(setUnreadCount)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleDeleteTransaction = useCallback((transaction) => {
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
              await transactionService.deleteTransaction(userId, transaction.id);
              loadDashboardData();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  }, [userId]);


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
              <Text style={styles.userName}>
                {profileLoading ? '...' : (name || 'User')}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={styles.iconButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Bell color={COLORS.text} size={22} />
              {unreadCount > 0 && (
                <View style={{
                  position: 'absolute', top: 4, right: 4,
                  backgroundColor: COLORS.error,
                  borderRadius: 6, minWidth: 14, height: 14,
                  paddingHorizontal: 3,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable style={styles.iconButton} onPress={handleSignOut}>
              <LogOut color={COLORS.error} size={22} />
            </Pressable>
          </View>
        </View>

        {/* Dashboard Cards Layout */}
        <View style={{ marginBottom: 24 }}>
          {/* 1. Total Amount: Loan + Cash in Hand */}
          <View style={[styles.balanceCard, { padding: 24, marginBottom: 12, backgroundColor: COLORS.primary }]}>
            <Text style={[styles.balanceLabel, { color: 'rgba(255,255,255,0.8)' }]}>Total Amount</Text>
            <Text style={[styles.balanceAmount, { fontSize: SCREEN_WIDTH * 0.08, color: '#fff', marginBottom: 0 }]} numberOfLines={1} adjustsFontSizeToFit>
              {currency} {formatAmount(totals.totalAmount)}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 }}>
              Cash: {formatAmount(totals.cashInHand)} | Net Loan: {formatAmount(totals.loan.netRemaining)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            {/* 2. Total Cash In Hand: Incoming */}
            <View style={[styles.balanceCard, { flex: 1, marginRight: 6, marginBottom: 0, padding: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: 'rgba(0, 230, 118, 0.2)' }]}>
              <Text style={[styles.balanceLabel, { color: COLORS.text, fontSize: 12, fontWeight: '600' }]}>Incoming</Text>
              <Text style={[styles.balanceAmount, { color: '#00e676', fontSize: SCREEN_WIDTH * 0.05, marginBottom: 0 }]} numberOfLines={1} adjustsFontSizeToFit>
                {currency} {formatAmount(totals.incoming)}
              </Text>
            </View>

            {/* 3. Total Expense of the Month: Outgoing */}
            <View style={[styles.balanceCard, { flex: 1, marginLeft: 6, marginBottom: 0, padding: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: 'rgba(255, 82, 82, 0.2)' }]}>
              <Text style={[styles.balanceLabel, { color: COLORS.text, fontSize: 12, fontWeight: '600' }]}>Outgoing</Text>
              <Text style={[styles.balanceAmount, { color: '#ff5252', fontSize: SCREEN_WIDTH * 0.05, marginBottom: 0 }]} numberOfLines={1} adjustsFontSizeToFit>
                {currency} {formatAmount(totals.outgoing)}
              </Text>
            </View>
          </View>

          {/* 4. Total Loan: Loan Amount, Remaining, Paid */}
          <View style={[styles.balanceCard, { padding: 18, backgroundColor: COLORS.accent, marginBottom: 0 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.balanceLabel, { color: 'rgba(255,255,255,0.9)', marginBottom: 0 }]}>Total Loan Status</Text>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>{currency} {formatAmount(totals.loan.remaining)} Left</Text>
            </View>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 10 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>LOAN AMOUNT</Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{formatAmount(totals.loan.total)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>TOTAL PAID</Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{formatAmount(totals.loan.paid)}</Text>
              </View>
            </View>
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
        <DonutChart 
          data={categoryBreakdown} 
          expenseChange={expenseChange} 
          monthlySpend={totals.monthlySpend} 
        />





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
                category={item.categories?.name || (item.type === 'income' ? 'Income' : 'Expense')}
                time={new Date(item.date).toLocaleDateString() + ' ' + new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                amount={parseFloat(item.amount)}
                method={item.description || ''}
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

        {/* Planned Payments Section */}
        {recentPlanned.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Payments</Text>
              <Pressable onPress={() => navigation.navigate('Planned')}>
                <Text style={styles.seeAllText}>See All</Text>
              </Pressable>
            </View>
            {recentPlanned.map((item) => (
              <PaymentCard 
                key={item.id} 
                item={item} 
              />
            ))}
          </View>
        )}

        {/* Insights Section */}
        <View style={styles.insightsCard}>
          <View style={styles.insightsHeader}>
             <View>
               <Text style={styles.insightsTitle}>Wallet Insights</Text>
               <Text style={styles.insightsSub}>
                  30-day performance & future outlook
               </Text>
             </View>
             <View style={styles.insightsPill}>
                <TrendingUp color={COLORS.accent} size={14} style={{ marginRight: 6 }} />
                <Text style={styles.insightsPillText}>Live Analysis</Text>
             </View>
          </View>

          <View style={styles.predictiveRow}>
             <GaugeChart score={performanceMetrics.balanceScore} label="Balance Pred." />
             <View style={styles.verticalDivider} />
             <GaugeChart score={performanceMetrics.cashFlowScore} label="Cash-Flow Pred." />
          </View>

          <View style={styles.performanceGrid}>
             <View style={styles.gridItem}>
               <GaugeChart score={totals.totalAmount > 0 ? 85 : 15} label="Outlook" />
             </View>
             <View style={styles.gridItem}>
               <GaugeChart score={Math.min((totals.monthlySpend / (totals.totalIncome || 1)) * 100, 100)} label="Spendings" />
             </View>
             <View style={styles.gridItem}>
               <GaugeChart score={Math.min((totals.totalIncome / 100000) * 100, 100)} label="Credit" />
             </View>
             <View style={styles.gridItem}>
               <GaugeChart score={Math.min((totals.monthlySpend / 100000) * 100, 100)} label="Debit" />
             </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default DashboardOverview;
