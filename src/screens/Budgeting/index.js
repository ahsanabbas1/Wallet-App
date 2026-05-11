import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Modal, TextInput, Platform, KeyboardAvoidingView, Pressable
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Wallet, Target, Plus, Menu, X, Pencil, Trash2,
  AlertTriangle, CheckCircle, TrendingUp, RefreshCw, CalendarClock
} from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useTheme } from '../../context/ThemeContext';
import { makeStyles } from './styles';
import * as Icons from 'lucide-react-native';
import budgetService, { 
  decodeBudget, getActivePeriod, formatLocalDate, parseLocalDate, getRelatedCategoryIds
} from '../../services/budgetService';
import savingsGoalService from '../../services/savingsGoalService';
import { transactionService } from '../../services/transactionService';

// (Removed redundant local helpers)

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// (Removed redundant local helpers)

const Budgeting = ({ navigation }) => {
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const { currency: userCurrency } = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const labelStyle = { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 };
  const inputStyle = { backgroundColor: COLORS.inputBg, color: COLORS.text, padding: 14, borderRadius: 12, marginBottom: 16, fontSize: 15, borderWidth: 1, borderColor: COLORS.border };

  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [totals, setTotals] = useState({ remaining: 0, percentUsed: 0, totalBudget: 0, totalUsed: 0 });

  // Add/Edit budget modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [selCategoryId, setSelCategoryId] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  // Date/Freq state
  const [startDate, setStartDate] = useState(formatLocalDate(new Date()));
  const [endDate, setEndDate] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('start');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    try {
      setLoading(true);
      if (!userId) return;

      const period = currentPeriod();
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [budgetRes, txRes, goalRes, allCatRes] = await Promise.all([
        budgetService.getBudgets(userId),
        transactionService.getTransactions(userId, { period: 'ALL' }),
        savingsGoalService.getSavingsGoals(userId),
        transactionService.getCategories(userId),
      ]);

      const cats = allCatRes || [];
      setAllCategories(cats);

      // Parent expense categories only — used in the creation picker
      const parentExpCats = cats.filter(c => !c.parent_id && (c.type === 'expense' || c.type === 'both'));
      setExpenseCategories(parentExpCats);

      const txData = (txRes.data || []).filter(
        (tx) => tx.type === 'expense' && new Date(tx.date) >= new Date(firstDay)
      );

      // ── KEY FIX: match transactions against category + all its children ──
      const processedBudgets = (budgetRes.data || []).map(raw => {
        const b = decodeBudget(raw);
        // Determine the actual range to check for this budget
        const { start: activeStart, end: activeEnd } = getActivePeriod(b.start_date, b.frequency);
        
        const relatedIds = getRelatedCategoryIds(b.category_id, cats);
        const spent = txData
          .filter(t => {
            const txDate = t.date.split('T')[0];
            const isInCategory = relatedIds.includes(t.category_id);
            const isInRange = txDate >= activeStart && (!activeEnd || txDate <= activeEnd);
            return isInCategory && isInRange;
          })
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        return { ...b, used: spent, activeStart, activeEnd };
      });

      setBudgets(processedBudgets);
      setGoals(goalRes.data || []);

      const totalBudget = processedBudgets.reduce((s, b) => s + parseFloat(b.total_amount), 0);
      const totalUsed = processedBudgets.reduce((s, b) => s + b.used, 0);
      setTotals({
        remaining: totalBudget - totalUsed,
        percentUsed: totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0,
        totalBudget,
        totalUsed,
      });

      // Budget alerts are handled by notificationService — no inline Alert.alert here

    } catch (error) {
      console.error('Budgeting fetch error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Refresh whenever the screen comes into focus
  useFocusEffect(useCallback(() => { fetchData(); }, [userId]));

  // ── Realtime subscription: update instantly when transactions or budgets change
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`budget_realtime_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${userId}` },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_goals', filter: `user_id=eq.${userId}` },
        () => fetchData()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const onDateChange = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) {
      if (pickerMode === 'start') {
        setStartDate(formatLocalDate(selectedDate));
      } else {
        setEndDate(formatLocalDate(selectedDate));
      }
    }
  };

  // ── Budget CRUD ────────────────────────────────────────────────────────────

  const openAddModal = (budget = null) => {
    setEditingBudget(budget);
    setSelCategoryId(budget?.category_id || expenseCategories[0]?.id || '');
    setBudgetAmount(budget ? budget.total_amount.toString() : '');
    setStartDate(budget?.start_date || formatLocalDate(new Date()));
    setEndDate(budget?.end_date || '');
    setFrequency(budget?.frequency || 'monthly');
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
      const data = { 
        user_id: userId, 
        category_id: selCategoryId, 
        total_amount: parseFloat(budgetAmount), 
        period,
        start_date: startDate,
        end_date: endDate || null,
        frequency: frequency
      };

      if (editingBudget) {
        await budgetService.saveBudget(userId, {
          ...editingBudget,
          ...data,
          categories: editingBudget.categories,
        }, editingBudget.id);
      } else {
        const existing = budgets.find((budget) =>
          budget.category_id === selCategoryId && budget.period === period
        );
        if (existing) {
          await budgetService.saveBudget(userId, {
            ...existing,
            total_amount: parseFloat(budgetAmount),
            categories: existing.categories,
          }, existing.id);
        } else {
          const category = allCategories.find((item) => item.id === selCategoryId);
          await budgetService.saveBudget(userId, {
            ...data,
            categories: category || null,
          });
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
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await budgetService.deleteBudget(userId, budget.id);
            fetchData();
          } catch (error) {
            Alert.alert('Error', error.message);
          }
        }
      }
    ]);
  };

  const progressColor = (pct) => pct >= 100 ? COLORS.error : pct >= 80 ? COLORS.warning : COLORS.primary;
  const totalPct = Math.min(totals.percentUsed, 100);
  const overallColor = progressColor(totals.percentUsed);

  if (loading && budgets.length === 0) {
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
          <TouchableOpacity onPress={fetchData} style={{ padding: 8 }}>
            <RefreshCw color={COLORS.textSecondary} size={18} />
          </TouchableOpacity>
        </View>

        {/* Overall Budget Summary Card */}
        <View style={[styles.remainingCard, { borderColor: overallColor + '33' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <Text style={styles.remainingLabel}>Monthly Budget Remaining</Text>
            {totals.percentUsed >= 80 && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AlertTriangle color={overallColor} size={15} />
                <Text style={{ color: overallColor, fontSize: 12, marginLeft: 4, fontWeight: '700' }}>
                  {totals.percentUsed >= 100 ? 'Exceeded!' : 'Near Limit'}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.remainingAmount, { color: totals.remaining < 0 ? COLORS.error : COLORS.text }]}>
            {userCurrency} {Math.abs(totals.remaining).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            {totals.remaining < 0 ? ' over' : ''}
          </Text>

          <View style={[styles.progressContainer, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <View style={[styles.progressBar, { width: `${totalPct}%`, backgroundColor: overallColor }]} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={styles.progressText}>
              Spent: {userCurrency} {totals.totalUsed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Text>
            <Text style={[styles.progressText, { color: overallColor, fontWeight: '700' }]}>
              {totals.percentUsed.toFixed(0)}% used
            </Text>
          </View>
        </View>

        {/* Category Budgets Section */}
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
            const catColor = b.categories?.color || COLORS.primary;
            return (
              <View key={b.id} style={[styles.card, { borderLeftWidth: 3, borderLeftColor: color }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: catColor + '22' }]}>
                    <IC color={catColor} size={20} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{b.categories?.name || 'Uncategorized'}</Text>
                    <Text style={styles.cardValue}>
                      {userCurrency} {b.used.toLocaleString(undefined, { maximumFractionDigits: 0 })} spent of {userCurrency} {parseFloat(b.total_amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    {pct >= 80 && <AlertTriangle color={color} size={15} />}
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

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>
                    Remaining: {userCurrency} {Math.max(parseFloat(b.total_amount) - b.used, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{pct.toFixed(0)}%</Text>
                </View>
              </View>
            );
          }) : (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 16, padding: 32, alignItems: 'center' }}>
              <Wallet color={COLORS.textSecondary} size={40} style={{ marginBottom: 12 }} />
              <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 16 }}>No budgets yet</Text>
              <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: 6, fontSize: 13 }}>
                Tap + to create a budget for a category
              </Text>
            </View>
          )}
        </View>

        {/* Savings Goals Section */}
        <View style={styles.sectionHeader}>
          <TouchableOpacity onPress={() => navigation.navigate('Savings Goals')}>
            <Text style={styles.sectionTitle}>Savings Goals</Text>
          </TouchableOpacity>
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
                      {userCurrency} {saved.toLocaleString()} saved of {userCurrency} {target.toLocaleString()}
                    </Text>
                  </View>
                  {pct >= 100 && <CheckCircle color={COLORS.success} size={20} />}
                </View>
                <View style={styles.miniProgressContainer}>
                  <View style={[styles.miniProgressBar, { width: `${pct}%`, backgroundColor: gColor }]} />
                </View>
                <Text style={{ color: gColor, fontSize: 11, marginTop: 6, textAlign: 'right', fontWeight: '700' }}>
                  {pct.toFixed(0)}% saved
                </Text>
              </View>
            );
          }) : (
            <Text style={{ color: COLORS.textSecondary, textAlign: 'center', padding: 20 }}>
              No savings goals. Tap + to create one.
            </Text>
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
                {editingBudget ? 'Edit Budget' : 'Set Monthly Budget'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={{ padding: 4 }}>
                <X color={COLORS.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <Text style={labelStyle}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {expenseCategories.map(cat => {
                    const IC = Icons[cat.icon] || Wallet;
                    const selected = selCategoryId === cat.id;
                    const catColor = cat.color || COLORS.primary;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
                          backgroundColor: selected ? catColor : COLORS.background,
                          borderWidth: 1,
                          borderColor: selected ? catColor : 'rgba(255,255,255,0.1)',
                          flexDirection: 'row', alignItems: 'center', gap: 6
                        }}
                        onPress={() => setSelCategoryId(cat.id)}
                      >
                        <IC color={selected ? '#fff' : catColor} size={14} />
                        <Text style={{ color: selected ? '#fff' : COLORS.textSecondary, fontSize: 13 }}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <Text style={labelStyle}>Budget Limit ({userCurrency})</Text>
              <TextInput
                style={inputStyle}
                placeholder="e.g. 20000"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="decimal-pad"
                onChangeText={setBudgetAmount}
              />

              <Text style={labelStyle}>Frequency</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {['once', 'daily', 'weekly', 'monthly', 'yearly'].map(f => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setFrequency(f)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                      backgroundColor: frequency === f ? COLORS.primary : COLORS.background,
                      borderWidth: 1, borderColor: frequency === f ? COLORS.primary : COLORS.border
                    }}
                  >
                    <Text style={{ 
                      color: frequency === f ? '#fff' : COLORS.textSecondary, 
                      fontSize: 12, fontWeight: '700', textTransform: 'uppercase' 
                    }}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Start Date</Text>
                  <TouchableOpacity
                    onPress={() => { setPickerMode('start'); setShowPicker(true); }}
                    style={[inputStyle, { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 0 }]}
                  >
                    <CalendarClock size={16} color={COLORS.primary} />
                    <Text style={{ color: COLORS.text }}>{startDate}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={labelStyle}>End Date (Optional)</Text>
                    {endDate ? (
                      <Pressable onPress={() => setEndDate('')}>
                        <Text style={{ color: COLORS.error, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>CLEAR</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => { setPickerMode('end'); setShowPicker(true); }}
                    style={[inputStyle, { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 0 }]}
                  >
                    <CalendarClock size={16} color={COLORS.textSecondary} />
                    <Text style={{ color: endDate ? COLORS.text : COLORS.textSecondary }}>
                      {endDate || 'No end'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {showPicker && (
                <DateTimePicker
                  value={pickerMode === 'start' ? parseLocalDate(startDate) : (endDate ? parseLocalDate(endDate) : new Date())}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                />
              )}

              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 20 }}>
                Applies to: {getActivePeriod(startDate, frequency).start} to {getActivePeriod(startDate, frequency).end || 'No end'}
              </Text>

              {selCategoryId && (
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 20 }}>
                  Spending will include transactions from this category and all its sub-categories.
                </Text>
              )}

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


export default Budgeting;
