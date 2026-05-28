import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Dimensions, AppState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  Wallet,
  RefreshCcw,
  Eye,
  EyeOff,
  ArrowLeftRight,
} from 'lucide-react-native';
import CurrencyConverterModal from '../../components/CurrencyConverterModal';
import CashFlowForecastCard from '../../components/CashFlowForecastCard';
import HeaderMenu from '../../components/HeaderMenu';

import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';

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
import WhatsNewModal from '../../components/WhatsNewModal';
import { APP_VERSION } from '../../constants/changelog';
import { getDb } from '../../lib/db';


const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DashboardOverview = () => {
  const navigation = useNavigation();
  const { openDrawer } = useDrawer();
  const { userId, dbReady, signOut } = useAuth();
  const { currency, name, loading: profileLoading } = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [recentPlanned, setRecentPlanned] = useState([]);
  const [recentLoans, setRecentLoans] = useState([]);
  const [totals, setTotals] = useState({
    totalAmount: 0,
    incoming: 0,
    outgoing: 0,
    cashInHand: 0,
    monthlySpend: 0,
    totalSaved: 0,
    totalIncome: 0,
    loan: { total: 0, paid: 0, remaining: 0, netRemaining: 0 },
    budget: { totalBudget: 0, totalUsed: 0, count: 0 }
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [expenseChange, setExpenseChange] = useState(0);
  const [savingsProgress, setSavingsProgress] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState({ balanceScore: 0, cashFlowScore: 0 });
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showConverter, setShowConverter] = useState(false);

  const mv = (formatted) => balanceVisible ? formatted : '••••••';

  // Single load function — uses userId from context, no extra getSession() call
  const loadDashboardData = async () => {
    if (!userId || !dbReady) return;
    try {
      setLoading(true);

      // Fire-and-forget notification generation + unread count (non-blocking)
      generateNotifications(userId)
        .then(() => getUnreadCount(userId).then(setUnreadCount))
        .catch(() => { });

      const dashData = await dashboardService.getDashboardData(userId);


      setRecentTransactions(dashData.recentTransactions);
      setRecentPlanned(dashData.recentPlanned);
      setRecentLoans(dashData.recentLoans || []);
      setTotals(dashData.totals);
      setCategoryBreakdown(dashData.categoryBreakdown);
      setExpenseChange(dashData.expenseChange);
      setPerformanceMetrics(dashData.performanceMetrics);
      setSavingsProgress(dashData.savingsProgress);
    } catch (error) {
      console.error('Dashboard load error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [userId, dbReady])
  );

  useFocusEffect(
    useCallback(() => {
      if (!userId || !dbReady) return;
      const checkVersion = async () => {
        try {
          const db = getDb();
          const row = await db.getFirstAsync('SELECT last_seen_version FROM users WHERE id = ?', [userId]);
          if (!row || row.last_seen_version !== APP_VERSION) {
            setShowWhatsNew(true);
          }
        } catch (_) {}
      };
      checkVersion();
    }, [userId, dbReady])
  );

  // Idle refresh: reload when app comes back from background after > 5 mins
  useEffect(() => {
    let lastActive = Date.now();
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        const now = Date.now();
        if (now - lastActive > 1000 * 60 * 5) { // 5 minutes
          loadDashboardData();
        }
        lastActive = now;
      } else if (nextAppState === 'background') {
        lastActive = Date.now();
      }
    });
    return () => subscription.remove();
  }, []);

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



  const handleDismissWhatsNew = async () => {
    setShowWhatsNew(false);
    try {
      const db = getDb();
      await db.runAsync('UPDATE users SET last_seen_version = ? WHERE id = ?', [APP_VERSION, userId]);
    } catch (_) {}
  };

  const handleSignOut = () => signOut();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
            <Pressable
              style={[styles.iconButton, { marginRight: 12 }]}
              onPress={openDrawer}
            >
              <Menu color={COLORS.text} size={24} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.userName} numberOfLines={1}>
                {profileLoading ? '...' : (name || 'User')}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Pressable
              style={styles.iconButton}
              onPress={() => setBalanceVisible(v => !v)}
            >
              {balanceVisible
                ? <Eye color={COLORS.text} size={20} />
                : <EyeOff color={COLORS.textSecondary} size={20} />}
            </Pressable>
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
            <HeaderMenu
              items={[
                { icon: RefreshCcw,    label: 'Refresh',            onPress: loadDashboardData },
                { icon: ArrowLeftRight,label: 'Currency Converter',  onPress: () => setShowConverter(true) },
                { icon: LogOut,        label: 'Sign Out',            onPress: handleSignOut, danger: true },
              ]}
            />
          </View>
        </View>

        {/* Dashboard Cards Layout */}
        <View style={{ marginBottom: 24 }}>
          {/* 1. Total Amount: Comprehensive Executive Summary */}
          <LinearGradient
            colors={['#4f5ff7', '#7c4dff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.balanceCard, { padding: 24, marginBottom: 16, borderHeight: 0 }]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={[styles.balanceLabel, { color: 'rgba(255,255,255,0.8)', marginBottom: 4 }]}>Total Net Worth</Text>
                <Text style={[styles.balanceAmount, { fontSize: SCREEN_WIDTH * 0.085, color: '#fff', marginBottom: 0, fontWeight: '800' }]} numberOfLines={1} adjustsFontSizeToFit>
                  {mv(`${currency} ${formatAmount(totals.totalAmount)}`)}
                </Text>
              </View>
              <TrendingUp color="rgba(255,255,255,0.4)" size={24} />
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 20 }} />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
              <View style={{ minWidth: '40%' }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Available Cash</Text>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 }}>{mv(`${currency} ${formatAmount(totals.cashInHand)}`)}</Text>
              </View>
              <View style={{ minWidth: '40%' }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Net Loan Pos.</Text>
                <Text style={{ color: '#00e676', fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                  {mv(`${totals.loan.netRemaining >= 0 ? '+' : ''}${formatAmount(totals.loan.netRemaining)}`)}
                </Text>
              </View>
              <View style={{ minWidth: '40%' }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Budget Usage</Text>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                  {mv(`${((totals.budget.totalUsed / (totals.budget.totalBudget || 1)) * 100).toFixed(0)}%`)}
                </Text>
              </View>
              <View style={{ minWidth: '40%' }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Savings</Text>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                  {mv(`${savingsProgress.toFixed(0)}%`)}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            {/* 2. Total Cash In Hand: Income - Expense */}
            <View style={[styles.balanceCard, { flex: 1, marginRight: 6, marginBottom: 0, padding: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: 'rgba(0, 230, 118, 0.2)' }]}>
              <Text style={[styles.balanceLabel, { color: COLORS.text, fontSize: 12, fontWeight: '600' }]}>Cash In Hand</Text>
              <Text style={[styles.balanceAmount, { color: '#00e676', fontSize: SCREEN_WIDTH * 0.05, marginBottom: 0 }]} numberOfLines={1} adjustsFontSizeToFit>
                {mv(`${currency} ${formatAmount(totals.cashInHand)}`)}
              </Text>
              <Text style={{ color: 'rgba(0, 230, 118, 0.7)', fontSize: 10, fontWeight: '600', marginTop: 4 }}>
                {mv(`${((totals.cashInHand / (totals.totalIncome || 1)) * 100).toFixed(1)}% liquidity`)}
              </Text>
            </View>
 
            {/* 3. Total Expense of the Month: Outgoing */}
            <View style={[styles.balanceCard, { flex: 1, marginLeft: 6, marginBottom: 0, padding: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: 'rgba(255, 82, 82, 0.2)' }]}>
              <Text style={[styles.balanceLabel, { color: COLORS.text, fontSize: 12, fontWeight: '600' }]}>Expenses</Text>
              <Text style={[styles.balanceAmount, { color: '#ff5252', fontSize: SCREEN_WIDTH * 0.05, marginBottom: 0 }]} numberOfLines={1} adjustsFontSizeToFit>
                {mv(`${currency} ${formatAmount(totals.outgoing)}`)}
              </Text>
              <Text style={{ color: expenseChange > 0 ? COLORS.error : COLORS.success, fontSize: 10, fontWeight: '600', marginTop: 4 }}>
                {mv(`${expenseChange > 0 ? '↑' : '↓'} ${Math.abs(expenseChange).toFixed(1)}% vs prev`)}
              </Text>
            </View>
          </View>

          {/* 4. Budget Status Card */}
          {totals.budget.count > 0 && (
            <Pressable 
              onPress={() => navigation.navigate('Budgeting')}
              style={({ pressed }) => [
                styles.balanceCard, 
                { 
                  padding: 18, 
                  backgroundColor: COLORS.primary, 
                  marginBottom: 12, 
                  borderWidth: 1, 
                  borderColor: 'rgba(255,255,255,0.1)',
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }]
                }
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={[styles.balanceLabel, { color: 'rgba(255,255,255,0.9)', marginBottom: 2 }]}>Budget Overview</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>{totals.budget.count} ACTIVE BUDGETS</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{mv(`${currency} ${formatAmount(Math.max(0, totals.budget.totalBudget - totals.budget.totalUsed))} Left`)}</Text>
                  <Text style={{ color: totals.budget.totalUsed > totals.budget.totalBudget ? '#ff5252' : '#00e676', fontSize: 10, fontWeight: '700' }}>
                    {mv(`${((totals.budget.totalUsed / (totals.budget.totalBudget || 1)) * 100).toFixed(0)}% USED`)}
                  </Text>
                </View>
              </View>
              
              <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginVertical: 12, overflow: 'hidden' }}>
                <View style={{ 
                  height: '100%', 
                  width: `${Math.min(100, (totals.budget.totalUsed / (totals.budget.totalBudget || 1)) * 100)}%`, 
                  backgroundColor: totals.budget.totalUsed > totals.budget.totalBudget ? '#ff5252' : COLORS.accent,
                  borderRadius: 3 
                }} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>TOTAL BUDGET</Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{mv(formatAmount(totals.budget.totalBudget))}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>TOTAL SPENT</Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{mv(formatAmount(totals.budget.totalUsed))}</Text>
                </View>
              </View>
            </Pressable>
          )}

          {/* 5. Total Loan: Loan Amount, Remaining, Paid */}
          {totals.loan.total > 0 && totals.loan.remaining > 0 && (
            <Pressable 
              onPress={() => navigation.navigate('Loans')}
              style={({ pressed }) => [
                styles.balanceCard, 
                { 
                  padding: 18, 
                  backgroundColor: COLORS.accent, 
                  marginBottom: 0,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }]
                }
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.balanceLabel, { color: 'rgba(255,255,255,0.9)', marginBottom: 0 }]}>Total Loan Status</Text>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{mv(`${currency} ${formatAmount(totals.loan.remaining)} Left`)}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 10 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>LOAN AMOUNT</Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{mv(formatAmount(totals.loan.total))}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>TOTAL PAID</Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{mv(formatAmount(totals.loan.paid))}</Text>
                </View>
              </View>
            </Pressable>
          )}
        </View>

        {/* Cash Flow Forecast */}
        <CashFlowForecastCard userId={userId} />

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
                masked={!balanceVisible}
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

        {/* Recent Loans Section */}
        {recentLoans.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Loans</Text>
              <Pressable onPress={() => navigation.navigate('Loans')}>
                <Text style={styles.seeAllText}>See All</Text>
              </Pressable>
            </View>
            <View style={styles.transactionsList}>
              {recentLoans.map((loan) => (
                <View key={loan.id} style={styles.transactionItem}>
                  <View style={[styles.transactionIcon, { backgroundColor: loan.type === 'given' ? COLORS.error + '22' : COLORS.success + '22' }]}>
                    <Wallet color={loan.type === 'given' ? COLORS.error : COLORS.success} size={20} />
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionTitle}>{loan.person_name}</Text>
                    <Text style={styles.transactionSub}>{loan.type === 'given' ? 'Money Given' : 'Money Received'}</Text>
                  </View>
                  <View style={styles.transactionAmountContainer}>
                    <Text style={[styles.transactionAmount, { color: loan.type === 'given' ? COLORS.error : COLORS.success }]}>
                      {mv(`${currency} ${formatAmount(loan.total_amount)}`)}
                    </Text>
                    <Text style={styles.transactionMethod}>{mv(`${formatAmount(loan.remaining)} remaining`)}</Text>
                  </View>
                </View>
              ))}
            </View>
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
      <WhatsNewModal visible={showWhatsNew} onDismiss={handleDismissWhatsNew} />
      <CurrencyConverterModal visible={showConverter} onClose={() => setShowConverter(false)} />
    </SafeAreaView>
  );
};

export default DashboardOverview;
