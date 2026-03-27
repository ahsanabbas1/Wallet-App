import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { Wallet, TrendingUp, Target, Plus, Utensils, Zap, Car, Plane, Menu, ShoppingCart, Fuel, Briefcase, Tv, HelpCircle } from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { styles } from './styles';
import { COLORS } from '../../constants/theme';

const Budgeting = ({ navigation }) => {
  const { openDrawer } = useDrawer();
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [totals, setTotals] = useState({ remaining: 0, percentUsed: 0 });

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Fetch Budgets
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*, categories(*)')
        .eq('user_id', session.user.id);
      
      // Fetch Transactions for specific period (simplifying to current month)
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: transData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('type', 'expense')
        .gte('date', firstDay);

      // Fetch Goals
      const { data: goalData } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', session.user.id);

      const processedBudgets = (budgetData || []).map(b => {
        const spent = (transData || [])
          .filter(t => t.category_id === b.category_id)
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        return { ...b, used: spent };
      });

      setBudgets(processedBudgets);
      setGoals(goalData || []);

      const totalBudget = processedBudgets.reduce((sum, b) => sum + parseFloat(b.total_amount), 0);
      const totalUsed = processedBudgets.reduce((sum, b) => sum + b.used, 0);
      const remaining = totalBudget - totalUsed;
      const percentUsed = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

      setTotals({ remaining, percentUsed });
    } catch (error) {
      console.error('Error fetching budgeting data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const getIcon = (iconName) => {
    const icons = {
      Utensils, Zap, Car, Plane, ShoppingCart, Fuel, Briefcase, Tv
    };
    return icons[iconName] || HelpCircle;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <TouchableOpacity 
          style={{ marginRight: 16 }}
          onPress={openDrawer}
        >
          <Menu color={COLORS.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monthly Budget</Text>
      </View>
        
        {/* Remaining Balance Card */}
        <View style={styles.remainingCard}>
          <Text style={styles.remainingLabel}>Monthly Budget Remaining</Text>
          <Text style={styles.remainingAmount}>PKR {(totals.remaining || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${Math.min(totals.percentUsed || 0, 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>You've used {(totals.percentUsed || 0).toFixed(0)}% of your monthly budget.</Text>
        </View>

        {/* Category Budgets */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Category Budgets</Text>
          <TouchableOpacity>
            <Plus color={COLORS.primary} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.budgetList}>
          {budgets.length > 0 ? budgets.map(b => (
            <BudgetItem 
              key={b.id}
              icon={getIcon(b.categories?.icon)} 
              title={b.categories?.name || 'Uncategorized'} 
              used={b.used} 
              total={parseFloat(b.total_amount)} 
              color={b.categories?.color || COLORS.primary}
            />
          )) : (
            <Text style={{ color: COLORS.textSecondary, textAlign: 'center', padding: 20 }}>No budgets set for this month.</Text>
          )}
        </View>

        {/* Savings Goals */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Savings Goals</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Savings Goals')}>
            <Plus color={COLORS.primary} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.goalsList}>
          {goals.length > 0 ? goals.map(g => (
            <GoalItem 
              key={g.id}
              icon={getIcon(g.icon) || Target} 
              title={g.title} 
              saved={parseFloat(g.saved_amount || 0)} 
              goal={parseFloat(g.target_amount)} 
              color={g.color || COLORS.accent}
            />
          )) : (
            <Text style={{ color: COLORS.textSecondary, textAlign: 'center', padding: 20 }}>No savings goals active.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const BudgetItem = ({ icon: Icon, title, used, total, color }) => {
  const progress = (used / total) * 100;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Icon color={color} size={20} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardValue}>PKR {used} of PKR {total} used</Text>
        </View>
      </View>
      <View style={styles.miniProgressContainer}>
        <View style={[styles.miniProgressBar, { width: `${progress}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const GoalItem = ({ icon: Icon, title, saved, goal, color }) => {
  const progress = (saved / goal) * 100;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Icon color={color} size={20} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardValue}>PKR {saved.toLocaleString()} / PKR {goal.toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.miniProgressContainer}>
        <View style={[styles.miniProgressBar, { width: `${progress}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

export default Budgeting;
