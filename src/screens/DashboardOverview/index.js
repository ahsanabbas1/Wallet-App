import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Dimensions, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  Bell,
  Wallet,
  RefreshCcw,
  Eye,
  EyeOff,
  ArrowLeftRight,
  PiggyBank,
  Banknote,
} from 'lucide-react-native';
import CurrencyConverterModal from '../../components/CurrencyConverterModal';
import HealthScoreCard from '../../components/HealthScoreCard';
import HeaderMenu from '../../components/HeaderMenu';
import StatSummaryCard from '../../components/StatSummaryCard';
import InsightsPanel from '../../components/InsightsPanel';
import NetWorthCard from '../../components/NetWorthCard';
import RecurringSuggestionsCard from '../../components/RecurringSuggestionsCard';
import { PERIODS as TREND_PERIODS } from '../../components/Charts/IncomeExpenseTrendChart';

import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';

// Shared Components
import TransactionItem from '../../components/TransactionItem';
import PaymentCard from '../../components/PaymentCard';
import DonutChart from '../../components/Charts/DonutChart';

// Utils & Services
import { formatAmount } from '../../utils/formatters';
import { dashboardService } from '../../services/dashboardService';
import { transactionService } from '../../services/transactionService';
import { generateNotifications, getUnreadCount } from '../../services/notificationService';
import { netWorthService } from '../../services/netWorthService';
import { recurringDetectionService } from '../../services/recurringDetectionService';
import { paymentService } from '../../services/paymentService';
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
    loan: { total: 0, paid: 0, remaining: 0, netRemaining: 0, liabilities: 0, receivables: 0 },
    budget: { totalBudget: 0, totalUsed: 0, count: 0 }
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [netWorthHistory, setNetWorthHistory] = useState([]);
  const [trendTab, setTrendTab] = useState(0); // shared with the Financial Health trend chart
  const [recurringSuggestions, setRecurringSuggestions] = useState([]);
  const [expenseChange, setExpenseChange] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState({ balanceScore: 0, cashFlowScore: 0 });
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showConverter, setShowConverter] = useState(false);

  // Restore persisted visibility toggle (survives app lock/unlock)
  useEffect(() => {
    AsyncStorage.getItem('dashboard_balance_visible').then(val => {
      if (val === 'true') setBalanceVisible(true);
    });
  }, []);

  const toggleVisibility = () => {
    setBalanceVisible(v => {
      const next = !v;
      AsyncStorage.setItem('dashboard_balance_visible', String(next));
      return next;
    });
  };

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

      // Fire-and-forget net worth snapshot + history (non-blocking)
      netWorthService.backfillIfEmpty(userId)
        .then(() => netWorthService.snapshotToday(userId))
        .then(() => netWorthService.getHistoryByPeriod(userId, TREND_PERIODS[trendTab].key))
        .then(setNetWorthHistory)
        .catch(() => { });

      // Fire-and-forget recurring-transaction detection (non-blocking)
      recurringDetectionService.detect(userId)
        .then(setRecurringSuggestions)
        .catch(() => { });

      const dashData = await dashboardService.getDashboardData(userId);


      setRecentTransactions(dashData.recentTransactions);
      setRecentPlanned(dashData.recentPlanned);
      setRecentLoans(dashData.recentLoans || []);
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

  // Re-fetch just the net worth history when the shared trend period changes
  // (loadDashboardData only re-runs on focus, not on every tab switch)
  useEffect(() => {
    if (!userId || !dbReady) return;
    netWorthService.getHistoryByPeriod(userId, TREND_PERIODS[trendTab].key)
      .then(setNetWorthHistory)
      .catch(() => { });
  }, [userId, dbReady, trendTab]);

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
          const dontShow = await AsyncStorage.getItem('dont_show_whats_new');
          if (dontShow === 'true') return;
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

  const handleAddRecurring = useCallback(async (suggestion) => {
    try {
      const nextDateTime = new Date(`${suggestion.suggestedNextDate}T09:00:00`).toISOString();
      await paymentService.addPlannedPayment({
        user_id: userId,
        title: suggestion.title,
        amount: suggestion.amount,
        type: suggestion.type,
        frequency: suggestion.frequency,
        start_date: suggestion.suggestedNextDate,
        end_date: null,
        next_date: nextDateTime,
        category_id: suggestion.category_id,
        account_id: suggestion.account_id,
      });
      setRecurringSuggestions(prev => prev.filter(s => s.signature !== suggestion.signature));
      loadDashboardData();
    } catch (error) {
      Alert.alert('Error', `Could not add planned payment. ${error.message}`);
    }
  }, [userId]);

  const handleDismissRecurring = useCallback(async (suggestion) => {
    setRecurringSuggestions(prev => prev.filter(s => s.signature !== suggestion.signature));
    try {
      await recurringDetectionService.dismiss(userId, suggestion.signature);
    } catch (_) {}
  }, [userId]);

  const handleDismissWhatsNew = async (dontShowAgain) => {
    setShowWhatsNew(false);
    try {
      if (dontShowAgain) {
        await AsyncStorage.setItem('dont_show_whats_new', 'true');
      }
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
              onPress={toggleVisibility}
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
                  <Text style={{ color: COLORS.onGradient, fontSize: 9, fontWeight: '800' }}>
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
          {/* Financial Health (merged Net Worth + Health Score) */}
          <HealthScoreCard
            totals={totals}
            expenseChange={expenseChange}
            userId={userId}
            gradient
            balanceVisible={balanceVisible}
            trendTab={trendTab}
            onTrendTabChange={setTrendTab}
          />

          <View style={styles.statRow}>
            <StatSummaryCard
              icon={PiggyBank}
              accentColor={COLORS.primary}
              label="Budget"
              value={
                totals.budget.count > 0
                  ? mv(`${currency} ${formatAmount(Math.max(0, totals.budget.totalBudget - totals.budget.totalUsed))}`)
                  : 'No budget'
              }
              meta={
                totals.budget.count > 0
                  ? mv(`${((totals.budget.totalUsed / (totals.budget.totalBudget || 1)) * 100).toFixed(0)}% used · ${totals.budget.count} active`)
                  : 'Tap to create one'
              }
              progress={totals.budget.count > 0 ? totals.budget.totalUsed / (totals.budget.totalBudget || 1) : 0}
              progressColor={totals.budget.totalUsed > totals.budget.totalBudget ? COLORS.error : COLORS.primary}
              onPress={() => navigation.navigate('Budgeting')}
            />
            <StatSummaryCard
              icon={Banknote}
              accentColor={COLORS.accent}
              label="Loans"
              value={
                totals.loan.total === 0
                  ? 'No loans'
                  : totals.loan.remaining > 0
                    ? mv(`${currency} ${formatAmount(totals.loan.remaining)}`)
                    : 'Settled'
              }
              meta={totals.loan.total > 0 ? mv(`${formatAmount(totals.loan.paid)} paid of ${formatAmount(totals.loan.total)}`) : 'Tap to add one'}
              progress={totals.loan.total > 0 ? totals.loan.paid / totals.loan.total : 0}
              progressColor={totals.loan.remaining > 0 ? COLORS.accent : COLORS.success}
              onPress={() => navigation.navigate('Loans')}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActions}>
          <Pressable
            style={styles.actionItem}
            onPress={() => navigation.navigate('AddTransaction')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.primary + '40' }]}>
              <Plus color={COLORS.primary} size={24} />
            </View>
            <Text style={styles.actionText}>Add</Text>
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => navigation.navigate('Expenses')}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.accent + '40' }]}>
              <DollarSign color={COLORS.accent} size={24} />
            </View>
            <Text style={styles.actionText}>Ledger</Text>
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => navigation.navigate('Savings Goals')}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.warning + '40' }]}>
              <Target color={COLORS.warning} size={24} />
            </View>
            <Text style={styles.actionText}>Goal</Text>
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => navigation.navigate('Planned')}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.primary + '30' }]}>
              <CalendarClock color={COLORS.primary} size={24} />
            </View>
            <Text style={styles.actionText}>Planned</Text>
          </Pressable>
        </ScrollView>

        <RecurringSuggestionsCard
          suggestions={recurringSuggestions}
          onAdd={handleAddRecurring}
          onDismiss={handleDismissRecurring}
        />

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
        <InsightsPanel performanceMetrics={performanceMetrics} totals={totals} />

        {/* Net Worth History — follows the Financial Health trend period above */}
        <View style={{ marginTop: 24 }}>
          <NetWorthCard
            history={netWorthHistory}
            periodKey={TREND_PERIODS[trendTab].key}
            balanceVisible={balanceVisible}
          />
        </View>
      </ScrollView>
      <WhatsNewModal visible={showWhatsNew} onDismiss={handleDismissWhatsNew} />
      <CurrencyConverterModal visible={showConverter} onClose={() => setShowConverter(false)} />
    </SafeAreaView>
  );
};

export default DashboardOverview;
