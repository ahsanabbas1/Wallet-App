import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { TrendingUp, Target, Plus, Search, Menu, MoreHorizontal, DollarSign, LogOut, ReceiptText, Tag, Pencil, Trash2 } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { supabase } from '../../lib/supabase';
import styles from './styles';

const DashboardOverview = () => {
  const navigation = useNavigation();
  const { openDrawer } = useDrawer();
  const [userEmail, setUserEmail] = useState('Alex Rivera');
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ balance: 0, monthlySpend: 0 });
  const [savingsProgress, setSavingsProgress] = useState(0);

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

      setTotals({ balance, monthlySpend });

      // Fetch Savings Goals
      const { data: goalsData } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', session.user.id);
        
      if (goalsData && goalsData.length > 0) {
        const totalTarget = goalsData.reduce((sum, g) => sum + parseFloat(g.target_amount), 0);
        const totalSaved = goalsData.reduce((sum, g) => sum + parseFloat(g.current_amount), 0);
        const percent = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
        setSavingsProgress(percent);
      } else {
        setSavingsProgress(0);
      }

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

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>PKR {totals.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <TrendingUp color={COLORS.primary} size={20} />
              </View>
              <View>
                <Text style={styles.statLabel}>Monthly Spend</Text>
                <Text style={styles.statValue}>PKR {totals.monthlySpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Target color={COLORS.accent} size={20} />
              </View>
              <View>
                <Text style={styles.statLabel}>Savings Goal</Text>
                <Text style={styles.statValue}>{savingsProgress.toFixed(0)}%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => {
              console.log('Add button pressed');
              navigation.navigate('AddTransaction');
            }}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.primary }]}>
              <Plus color={COLORS.text} size={24} />
            </View>
            <Text style={styles.actionText}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.accent }]}>
              <DollarSign color={COLORS.text} size={24} />
            </View>
            <Text style={styles.actionText}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
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
      </ScrollView>
    </SafeAreaView>
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
    <View style={styles.transactionAmountContainer}>
      <Text style={[styles.transactionAmount, isPositive && { color: COLORS.accent }]}>{amount}</Text>
      <TouchableOpacity onPress={onEdit} style={styles.editButton}>
        <Tag color={COLORS.textSecondary} size={14} style={{ marginRight: 4 }} />
        <Text style={styles.transactionMethod}>{method}</Text>
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

export default DashboardOverview;
