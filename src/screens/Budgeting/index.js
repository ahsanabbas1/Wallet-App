import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Modal, TextInput, Platform, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Wallet, Target, Plus, Menu, X, Pencil, Trash2,
  AlertTriangle, CheckCircle, TrendingUp
} from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { styles } from './styles';
import { COLORS } from '../../constants/theme';
import * as Icons from 'lucide-react-native';

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const Budgeting = ({ navigation }) => {
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totals, setTotals] = useState({ remaining: 0, percentUsed: 0, totalBudget: 0, totalUsed: 0 });
  const [userCurrency, setUserCurrency] = useState('PKR');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [selCategoryId, setSelCategoryId] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (!userId) return;

      const period = currentPeriod();
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [budgetRes, txRes, goalRes, catRes, profileRes] = await Promise.all([
        supabase.from('budgets').select('*, categories(*)').eq('user_id', userId).eq('period', period),
        supabase.from('transactions').select('*').eq('user_id', userId).eq('type', 'expense').gte('date', firstDay),
        supabase.from('savings_goals').select('*').eq('user_id', userId),
        supabase.from('categories').select('*').or(`user_id.eq.${userId},user_id.is.null`).eq('type', 'expense').is('parent_id', null),
        supabase.from('users').select('currency').eq('id', userId).single(),
      ]);

      const currency = profileRes.data?.currency || 'PKR';
      setUserCurrency(currency);

      const processedBudgets = (budgetRes.data || []).map(b => {
        const spent = (txRes.data || [])
          .filter(t => t.category_id === b.category_id)
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        return { ...b, used: spent };
      });

      setBudgets(processedBudgets);
      setGoals(goalRes.data || []);
      setCategories(catRes.data || []);

      const totalBudget = processedBudgets.reduce((s, b) => s + parseFloat(b.total_amount), 0);
      const totalUsed = processedBudgets.reduce((s, b) => s + b.used, 0);
      const remaining = totalBudget - totalUsed;
      const percentUsed = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

      setTotals({ remaining, percentUsed, totalBudget, totalUsed });

      // Alert for over-budget categories
      processedBudgets.forEach(b => {
        const pct = b.total_amount > 0 ? (b.used / parseFloat(b.total_amount)) * 100 : 0;
        if (pct >= 100) {
          Alert.alert(
            '⚠️ Budget Exceeded',
            `Your "${b.categories?.name}" budget has been exceeded! (${pct.toFixed(0)}% used)`,
            [{ text: 'OK' }]
          );
        } else if (pct >= 80) {
          Alert.alert(
            '⚡ Budget Warning',
            `You've used ${pct.toFixed(0)}% of your "${b.categories?.name}" budget. Only ${currency} ${(parseFloat(b.total_amount) - b.used).toLocaleString()} remaining.`,
            [{ text: 'Got it' }]
          );
        }
      });
    } catch (error) {
      console.error('Budgeting error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const openAddModal = (budget = null) => {
    setEditingBudget(budget);
    setSelCategoryId(budget?.category_id || (categories[0]?.id || ''));
    setBudgetAmount(budget ? budget.total_amount.toString() : '');
    setShowAddModal(true);
  };

  const handleSaveBudget = async () => {
    if (!selCategoryId || !budgetAmount || parseFloat(budgetAmount) <= 0) {
      Alert.alert('Missing Fields', 'Please select a category and enter a valid amount.');
      return;
    }
    try {
      setSavingBudget(true);
      const period = currentPeriod();
      const data = { user_id: userId, category_id: selCategoryId, total_amount: parseFloat(budgetAmount), period };

      if (editingBudget) {
        const { error } = await supabase.from('budgets').update(data).eq('id', editingBudget.id);
        if (error) throw error;
      } else {
        // Check for existing budget for this category this month
        const { data: existing } = await supabase.from('budgets')
          .select('id').eq('user_id', userId).eq('category_id', selCategoryId).eq('period', period).single();
        if (existing) {
          const { error } = await supabase.from('budgets').update({ total_amount: parseFloat(budgetAmount) }).eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('budgets').insert(data);
          if (error) throw error;
        }
      }
      setShowAddModal(false);
      fetchData();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSavingBudget(false);
    }
  };

  const handleDeleteBudget = (budget) => {
    Alert.alert('Delete Budget', `Delete the "${budget.categories?.name}" budget?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('budgets').delete().eq('id', budget.id);
        if (error) Alert.alert('Error', error.message);
        else fetchData();
      }}
    ]);
  };

  const progressColor = (pct) => {
    if (pct >= 100) return COLORS.error;
    if (pct >= 80) return COLORS.warning;
    return COLORS.primary;
  };

  const totalPct = Math.min(totals.percentUsed, 100);
  const overallColor = progressColor(totals.percentUsed);

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

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity style={{ marginRight: 16 }} onPress={openDrawer}>
            <Menu color={COLORS.text} size={24} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Monthly Budget</Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 2 }}>
              {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <TrendingUp color={COLORS.primary} size={24} />
        </View>

        {/* Overall Budget Card */}
        <View style={[styles.remainingCard, { borderColor: overallColor + '33' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <Text style={styles.remainingLabel}>Monthly Budget Remaining</Text>
            {totals.percentUsed >= 80 && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AlertTriangle color={totals.percentUsed >= 100 ? COLORS.error : COLORS.warning} size={16} />
                <Text style={{ color: totals.percentUsed >= 100 ? COLORS.error : COLORS.warning, fontSize: 12, marginLeft: 4 }}>
                  {totals.percentUsed >= 100 ? 'Exceeded!' : 'Near Limit'}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.remainingAmount, { color: totals.remaining < 0 ? COLORS.error : COLORS.text }]}>
            {userCurrency} {Math.abs(totals.remaining).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            {totals.remaining < 0 ? ' over budget' : ''}
          </Text>
          <View style={[styles.progressContainer, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <View style={[styles.progressBar, { width: `${totalPct}%`, backgroundColor: overallColor }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.progressText}>
              {userCurrency} {totals.totalUsed.toLocaleString(undefined, { maximumFractionDigits: 0 })} spent
            </Text>
            <Text style={styles.progressText}>{totals.percentUsed.toFixed(0)}% used</Text>
          </View>
        </View>

        {/* Category Budgets */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Category Budgets</Text>
          <TouchableOpacity
            style={{ backgroundColor: COLORS.primary + '22', borderRadius: 8, padding: 6 }}
            onPress={() => openAddModal()}
          >
            <Plus color={COLORS.primary} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.budgetList}>
          {budgets.length > 0 ? budgets.map(b => {
            const pct = parseFloat(b.total_amount) > 0 ? (b.used / parseFloat(b.total_amount)) * 100 : 0;
            const color = progressColor(pct);
            const IC = Icons[b.categories?.icon] || Wallet;
            return (
              <View key={b.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: (b.categories?.color || COLORS.primary) + '22' }]}>
                    <IC color={b.categories?.color || COLORS.primary} size={20} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{b.categories?.name || 'Uncategorized'}</Text>
                    <Text style={styles.cardValue}>
                      {userCurrency} {b.used.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {userCurrency} {parseFloat(b.total_amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    {pct >= 80 && <AlertTriangle color={color} size={16} />}
                    <TouchableOpacity onPress={() => openAddModal(b)}>
                      <Pencil color={COLORS.textSecondary} size={16} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteBudget(b)}>
                      <Trash2 color={COLORS.error} size={16} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.miniProgressContainer}>
                  <View style={[styles.miniProgressBar, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
                </View>
                <Text style={{ color: color, fontSize: 11, marginTop: 6, textAlign: 'right' }}>
                  {pct.toFixed(0)}% used
                </Text>
              </View>
            );
          }) : (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 16, padding: 32, alignItems: 'center' }}>
              <Wallet color={COLORS.textSecondary} size={40} style={{ marginBottom: 12 }} />
              <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 16 }}>No budgets yet</Text>
              <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: 6 }}>Tap + to create a budget for a category</Text>
            </View>
          )}
        </View>

        {/* Savings Goals */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Savings Goals</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Savings Goals')}>
            <Plus color={COLORS.primary} size={20} />
          </TouchableOpacity>
        </View>

        <View style={[styles.goalsList, { marginBottom: 32 }]}>
          {goals.length > 0 ? goals.map(g => {
            const saved = parseFloat(g.saved_amount || 0);
            const target = parseFloat(g.target_amount);
            const pct = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
            const gColor = pct >= 100 ? COLORS.success : pct >= 75 ? COLORS.warning : COLORS.accent;
            return (
              <View key={g.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: gColor + '22' }]}>
                    <Target color={gColor} size={20} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{g.title}</Text>
                    <Text style={styles.cardValue}>
                      {userCurrency} {saved.toLocaleString()} / {userCurrency} {target.toLocaleString()}
                    </Text>
                  </View>
                  {pct >= 100 && <CheckCircle color={COLORS.success} size={20} />}
                </View>
                <View style={styles.miniProgressContainer}>
                  <View style={[styles.miniProgressBar, { width: `${pct}%`, backgroundColor: gColor }]} />
                </View>
                <Text style={{ color: gColor, fontSize: 11, marginTop: 6, textAlign: 'right' }}>{pct.toFixed(0)}% saved</Text>
              </View>
            );
          }) : (
            <Text style={{ color: COLORS.textSecondary, textAlign: 'center', padding: 20 }}>No savings goals active.</Text>
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Budget Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={{ backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: 'bold' }}>
                {editingBudget ? 'Edit Budget' : 'New Budget'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={{ padding: 4 }}>
                <X color={COLORS.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <Text style={labelStyle}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {categories.map(cat => {
                    const IC = Icons[cat.icon] || Wallet;
                    const selected = selCategoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
                          backgroundColor: selected ? (cat.color || COLORS.primary) : COLORS.background,
                          borderWidth: 1,
                          borderColor: selected ? (cat.color || COLORS.primary) : 'rgba(255,255,255,0.1)',
                          flexDirection: 'row', alignItems: 'center', gap: 6
                        }}
                        onPress={() => setSelCategoryId(cat.id)}
                      >
                        <IC color={selected ? '#fff' : (cat.color || COLORS.textSecondary)} size={14} />
                        <Text style={{ color: selected ? '#fff' : COLORS.textSecondary, fontSize: 13 }}>{cat.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <Text style={labelStyle}>Budget Amount ({userCurrency})</Text>
              <TextInput
                style={inputStyle}
                placeholder="e.g. 20000"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="decimal-pad"
                value={budgetAmount}
                onChangeText={setBudgetAmount}
              />

              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 20 }}>
                Period: {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
              </Text>

              <TouchableOpacity
                style={{ backgroundColor: COLORS.accent, padding: 16, borderRadius: 14, alignItems: 'center', opacity: savingBudget ? 0.7 : 1 }}
                onPress={handleSaveBudget}
                disabled={savingBudget}
              >
                {savingBudget
                  ? <ActivityIndicator color="#000" />
                  : <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>
                      {editingBudget ? 'Update Budget' : 'Create Budget'}
                    </Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const labelStyle = { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 };
const inputStyle = {
  backgroundColor: COLORS.background,
  color: COLORS.text,
  padding: 14,
  borderRadius: 12,
  marginBottom: 16,
  fontSize: 15,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
};

export default Budgeting;
