import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path, Circle, G, Text as SvgText } from 'react-native-svg';
import { COLORS } from '../../constants/theme';
import { TrendingUp, Target, Plus, Search, Menu, MoreHorizontal, DollarSign, LogOut, ReceiptText, Tag, Pencil, Trash2 } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { supabase } from '../../lib/supabase';
import styles from './styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatAmount = (amount) => {
  const num = parseFloat(amount || 0);
  if (num >= 10000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 100000) return (num / 1000).toFixed(0) + 'k';
  if (num >= 10000) return (num / 1000).toFixed(1) + 'k';
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const DashboardOverview = () => {
  const navigation = useNavigation();
  const { openDrawer } = useDrawer();
  const [userEmail, setUserEmail] = useState('User');
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ balance: 0, monthlySpend: 0, totalSaved: 0, totalIncome: 0 });
  const [savingsProgress, setSavingsProgress] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [performanceMetrics, setPerformanceMetrics] = useState({ balanceScore: 0, cashFlowScore: 0 });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email);
      }
    });
  }, []);

  const fetchRecentTransactions = async () => {
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
      
      // Top 5 for recent list
      setRecentTransactions(trans.slice(0, 5));

      // Calculate totals
      const income = trans.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const expense = trans.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const balance = income - expense;
      
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const monthlySpend = trans
        .filter(t => t.type === 'expense')
        .filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      // Fetch Savings Goals
      const { data: goalsData } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', session.user.id);
        
      let totalSavedCount = 0;
      if (goalsData && goalsData.length > 0) {
        const totalTarget = goalsData.reduce((sum, g) => sum + parseFloat(g.target_amount), 0);
        totalSavedCount = goalsData.reduce((sum, g) => sum + parseFloat(g.saved_amount || 0), 0);
        const percent = totalTarget > 0 ? (totalSavedCount / totalTarget) * 100 : 0;
        setSavingsProgress(percent);
      } else {
        setSavingsProgress(0);
      }

      setTotals({ balance, monthlySpend, totalSaved: totalSavedCount, totalIncome: income });

      // Process Category Breakdown (Donut Data)
      const catTotals = {};
      let totalExpense = 0;
      trans.filter(t => t.type === 'expense').forEach(t => {
        const catName = t.categories?.name || 'Other';
        const amount = parseFloat(t.amount);
        catTotals[catName] = (catTotals[catName] || 0) + amount;
        totalExpense += amount;
      });

      const breakdown = Object.keys(catTotals).map(name => ({
        name,
        amount: catTotals[name],
        percent: (catTotals[name] / totalExpense) * 100,
        color: trans.find(t => t.categories?.name === name)?.categories?.color || COLORS.primary
      })).sort((a,b) => b.amount - a.amount);
      
      setCategoryBreakdown(breakdown);

      // Calculations for Gauge
      // balanceScore: (Now vs goal) - simplify to (Income / Expense ratio or something)
      const balanceScore = Math.min(Math.max((income / (expense || 1)) * 50, 0), 100);
      const cashFlowScore = Math.min(Math.max((income - expense) > 0 ? 80 : 20, 0), 100);
      setPerformanceMetrics({ balanceScore, cashFlowScore });

    } catch (error) {
      console.error('Error fetching recent transactions:', error.message);
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
              fetchRecentTransactions();
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
      fetchRecentTransactions();
    }, [])
  );

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error', error.message);
  };

  // Helper component for Donuts with improved spacing and clickability
  const DonutChart = ({ data }) => {
    const radius = 70;
    const strokeWidth = 32;
    const centerX = 100;
    const centerY = 100;
    const circumference = 2 * Math.PI * radius;
    let currentOffset = 0;

    if (!data.length) return (
      <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: COLORS.textSecondary }}>No data for this period</Text>
      </View>
    );

    return (
      <View style={{ marginVertical: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
          <Svg height="180" width="180" viewBox="0 0 200 200">
            <G rotation="-90" origin="100, 100">
              {data.map((item, index) => {
                const dashLength = (item.percent / 100) * circumference;
                const dashOffset = currentOffset;
                currentOffset -= dashLength;
                
                return (
                  <Circle
                    key={index}
                    cx={centerX}
                    cy={centerY}
                    r={radius}
                    stroke={item.color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={`${dashLength} ${circumference}`}
                    strokeDashoffset={dashOffset}
                    onPress={() => setSelectedCategory(item)}
                  />
                );
              })}
            </G>
            <G pointerEvents="none">
              <SvgText x="100" y="95" fill={COLORS.text} fontSize="14" fontWeight="bold" textAnchor="middle">Expense</SvgText>
              <SvgText x="100" y="115" fill={COLORS.textSecondary} fontSize="10" textAnchor="middle">Breakdown</SvgText>
            </G>
          </Svg>

          {/* Legend Items */}
          <View style={{ maxWidth: '40%', gap: 8 }}>
            {data.slice(0, 4).map((item, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={{ flexDirection: 'row', alignItems: 'center' }}
                onPress={() => setSelectedCategory(item)}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color, marginRight: 8 }} />
                <Text style={{ color: COLORS.text, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {selectedCategory && (
          <View style={{ marginTop: 20, marginHorizontal: 20, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 16 }}>
            <Text style={{ color: selectedCategory.color, fontSize: 16, fontWeight: 'bold' }}>{selectedCategory.name}</Text>
            <Text style={{ color: COLORS.text, fontSize: 14, marginTop: 4 }}>
              PKR {formatAmount(selectedCategory.amount)} • {selectedCategory.percent.toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Precise Animated Needle using setNativeProps for performance
  const GaugeChart = ({ score, label }) => {
    const needleRef = React.useRef(null);
    const [displayScore, setDisplayScore] = useState(0);

    useEffect(() => {
      let start = 0;
      const end = score;
      const duration = 1500;
      const startTime = Date.now();

      const animate = () => {
        const now = Date.now();
        const progress = Math.min((now - startTime) / duration, 1);
        const currentScore = start + (end - start) * progress;
        
        // Update needle rotation directly on the Ref if we had access to G rotation...
        // But for consistency let's update state for the score text
        setDisplayScore(currentScore);

        if (progress < 1) requestAnimationFrame(animate);
      };
      animate();
    }, [score]);

    const rotation = (displayScore / 100) * 180 - 90;

    return (
      <View style={{ alignItems: 'center', flex: 1, padding: 5 }}>
        <Svg height="80" width="100" viewBox="0 0 100 60">
           {/* Background Track */}
           <Path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
           
           {/* Highlighted Color Regions */}
           <Path d="M 10 50 A 40 40 0 0 1 30 18" fill="none" stroke={COLORS.error} strokeWidth="8" strokeOpacity="0.8" />
           <Path d="M 30 18 A 40 40 0 0 1 70 18" fill="none" stroke={COLORS.warning} strokeWidth="8" strokeOpacity="0.8" />
           <Path d="M 70 18 A 40 40 0 0 1 90 50" fill="none" stroke={COLORS.accent} strokeWidth="8" strokeOpacity="0.8" />
           
           {/* Needle inside SVG for perfect center alignment */}
           <G rotation={rotation} origin="50, 50">
             <Path d="M 50 50 L 50 15" stroke={COLORS.text} strokeWidth="2.5" strokeLinecap="round" />
             <Circle cx="50" cy="50" r="3" fill={COLORS.text} />
           </G>
        </Svg>
        <Text style={{ color: COLORS.textSecondary, fontSize: 10, marginTop: 4 }}>{label}</Text>
        <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: 'bold' }}>{displayScore.toFixed(0)}%</Text>
      </View>
    );
  };

  const TransactionItem = ({ icon: Icon, title, category, time, amount, method, color, isPositive, onEdit, onDelete }) => (
    <View style={styles.transactionItem}>
      <View style={[styles.transactionIcon, { backgroundColor: color + '20' }]}>
        <Icon color={color} size={24} />
      </View>
      <View style={styles.transactionDetails}>
        <Text style={styles.transactionTitle}>{title}</Text>
        <Text style={styles.transactionSub}>{category} • {time}</Text>
      </View>
      <View style={[styles.transactionAmountContainer, { maxWidth: '30%' }]}>
        <Text style={[styles.transactionAmount, isPositive && { color: COLORS.accent }]} numberOfLines={1} adjustsFontSizeToFit>
          {parseFloat(amount.replace(/[^0-9.-]/g, '')) > 1000000 ? amount.substring(0, 1) + formatAmount(parseFloat(amount.replace(/[^0-9.-]/g, ''))) : amount}
        </Text>
        <TouchableOpacity onPress={onEdit} style={styles.editButton}>
          <Tag color={COLORS.textSecondary} size={14} style={{ marginRight: 4 }} />
          <Text style={styles.transactionMethod} numberOfLines={1} ellipsizeMode="tail">{method}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity onPress={onEdit} style={styles.pencilIcon}>
          <Pencil color={COLORS.textSecondary} size={20} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.deleteIcon}>
          <Trash2 color={COLORS.error} size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              style={[styles.iconButton, { marginRight: 16 }]}
              onPress={openDrawer}
            >
              <Menu color={COLORS.text} size={24} />
            </TouchableOpacity>
            <View>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.userName}>{userEmail.split('@')[0]}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={styles.iconButton} onPress={handleSignOut}>
              <LogOut color={COLORS.error} size={24} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Cash & Spend Cards */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
          <View style={[styles.balanceCard, { flex: 1, marginRight: 8, marginBottom: 0, padding: 20 }]}>
            <Text style={styles.balanceLabel}>Cash in PKR</Text>
            <Text style={[styles.balanceAmount, { fontSize: SCREEN_WIDTH * 0.06 }]} numberOfLines={1} adjustsFontSizeToFit>PKR {formatAmount(totals.balance)}</Text>
          </View>
          <View style={[styles.balanceCard, { flex: 1, marginLeft: 8, marginBottom: 0, padding: 20, backgroundColor: COLORS.accent }]}>
            <Text style={styles.balanceLabel}>Monthly Spend</Text>
            <Text style={[styles.balanceAmount, { fontSize: SCREEN_WIDTH * 0.06 }]} numberOfLines={1} adjustsFontSizeToFit>PKR {formatAmount(totals.monthlySpend)}</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => navigation.navigate('AddTransaction')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.primary }]}>
              <Plus color={COLORS.text} size={24} />
            </View>
            <Text style={styles.actionText}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Expenses')}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.accent }]}>
              <DollarSign color={COLORS.text} size={24} />
            </View>
            <Text style={styles.actionText}>Ledger</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Savings Goals')}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.warning }]}>
              <Target color={COLORS.text} size={24} />
            </View>
            <Text style={styles.actionText}>Goal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.card }]}>
              <MoreHorizontal color={COLORS.text} size={24} />
            </View>
            <Text style={styles.actionText}>More</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Expense Structure</Text>
        </View>
        <DonutChart data={categoryBreakdown} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Expenses')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsList}>
          {recentTransactions.length > 0 ? (
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
              <Text style={styles.emptyStateText}>
                {loading ? 'Loading transactions...' : 'No recent transactions found.'}
              </Text>
            </View>
          )}
        </View>

        {/* Wallet Dashboard Section */}
        <View style={{ marginTop: 30, padding: 16, backgroundColor: COLORS.card, borderRadius: 24, marginBottom: 40 }}>
          <View style={{ marginBottom: 20 }}>
             <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: 'bold' }}>Wallet Insights</Text>
             <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>Past 30 days performance and outlook for next 7 days</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
             <GaugeChart score={performanceMetrics.balanceScore} label="Balance Pred." />
             <GaugeChart score={performanceMetrics.cashFlowScore} label="Cash-Flow Pred." />
          </View>

          {/* 4x Needle Charts for Outlook/Spendings/Credit/Debit */}
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

const OutlookBox = ({ title, value, color }) => (
  <View style={{ width: '48%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 12, marginBottom: 16 }}>
    <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>{title}</Text>
    <Text style={{ color: color, fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>{value}</Text>
  </View>
);

export default DashboardOverview;
