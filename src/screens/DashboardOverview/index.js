import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  CalendarClock,
  TrendingUp,
  Bell,
} from 'lucide-react-native';

import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth } from '../../context/AuthContext';
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

import styles from './styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DashboardOverview = () => {
  const navigation = useNavigation();
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();

  const [userName, setUserName] = useState('User');
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [recentPlanned, setRecentPlanned] = useState([]);
  const [totals, setTotals] = useState({ balance: 0, monthlySpend: 0, totalSaved: 0, totalIncome: 0 });
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [expenseChange, setExpenseChange] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState({ balanceScore: 0, cashFlowScore: 0 });

  // Single load function — uses userId from context, no extra getSession() call
  const loadDashboardData = async () => {
    if (!userId) return;
    try {
      setLoading(true);

      // Fire-and-forget notification generation + unread count (non-blocking)
      generateNotifications(userId).then(() =>
        getUnreadCount(userId).then(setUnreadCount)
      );

      const [profileData, dashData] = await Promise.all([
        supabase.from('users').select('name').eq('id', userId).single(),
        dashboardService.getDashboardData(userId),
      ]);

      if (profileData.data?.name) setUserName(profileData.data.name);

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

  // Realtime: re-fetch data when transactions/payments change,
  // and update the bell badge live when notifications change.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`dashboard_realtime_${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        () => loadDashboardData()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'planned_payments', filter: `user_id=eq.${userId}` },
        () => loadDashboardData()
      )
      // Live bell count: re-query unread count whenever notifications table changes
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => getUnreadCount(userId).then(setUnreadCount)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

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
              loadDashboardData();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleDeletePlanned = (id) => {
    Alert.alert(
      'Delete Planned Payment',
      'Are you sure you want to stop this planned payment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
             try {
               const { error } = await supabase
                 .from('planned_payments')
                 .delete()
                 .eq('id', id);
               if (error) throw error;
               loadDashboardData();
             } catch (error) {
               Alert.alert('Error', error.message);
             }
          }
        }
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
                onDelete={handleDeletePlanned}
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
               <GaugeChart score={totals.balance > 0 ? 85 : 15} label="Outlook" />
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


