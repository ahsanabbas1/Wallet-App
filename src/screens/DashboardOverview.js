import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../constants/theme';
import { Wallet, TrendingUp, Target, Plus, Search, MoreHorizontal, ShoppingCart, Tv, DollarSign, Coffee, LogOut } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const DashboardOverview = () => {
  const navigation = useNavigation();
  const [userEmail, setUserEmail] = useState('Alex Rivera');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email);
      }
    });
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error', error.message);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Welcome back</Text>
            <Text style={styles.userName}>{userEmail.split('@')[0]}</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={[styles.iconButton, { marginRight: 12 }]}>
              <Search color={COLORS.text} size={24} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleSignOut}>
              <LogOut color={COLORS.error} size={24} />
            </TouchableOpacity>
          </View>
        </View>


        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>PKR 12,450.00</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <TrendingUp color={COLORS.primary} size={20} />
              </View>
              <View>
                <Text style={styles.statLabel}>Monthly Spend</Text>
                <Text style={styles.statValue}>PKR 1,200.00</Text>
              </View>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Target color={COLORS.accent} size={20} />
              </View>
              <View>
                <Text style={styles.statLabel}>Savings Goal</Text>
                <Text style={styles.statValue}>75%</Text>
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

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsList}>
          <TransactionItem 
            icon={ShoppingCart} 
            title="Whole Foods Market" 
            category="Groceries" 
            time="Today, 10:45 AM" 
            amount="-PKR 85.00" 
            method="Debit Card"
            color="#FF9800"
          />
          <TransactionItem 
            icon={Tv} 
            title="Netflix Subscription" 
            category="Entertainment" 
            time="Yesterday" 
            amount="-PKR 15.00" 
            method="Automatic"
            color="#F44336"
          />
          <TransactionItem 
            icon={DollarSign} 
            title="Monthly Salary" 
            category="Income" 
            time="2 days ago" 
            amount="+PKR 4,000.00" 
            method="Deposit"
            color="#4CAF50"
            isPositive
          />
          <TransactionItem 
            icon={Coffee} 
            title="Starbucks Coffee" 
            category="Food & Drink" 
            time="3 days ago" 
            amount="-PKR 6.45" 
            method="Apple Pay"
            color="#795548"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const TransactionItem = ({ icon: Icon, title, category, time, amount, method, color, isPositive }) => (
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
      <Text style={styles.transactionMethod}>{method}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  userName: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  iconButton: {
    padding: 8,
    backgroundColor: COLORS.card,
    borderRadius: 12,
  },
  balanceCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 32,
    marginBottom: 24,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginBottom: 8,
  },
  balanceAmount: {
    color: COLORS.text,
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  quickActions: {
    marginBottom: 24,
  },
  actionItem: {
    alignItems: 'center',
    marginRight: 24,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    color: COLORS.text,
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    color: COLORS.accent,
    fontSize: 14,
  },
  transactionsList: {
    gap: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  transactionMethod: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
});

export default DashboardOverview;
