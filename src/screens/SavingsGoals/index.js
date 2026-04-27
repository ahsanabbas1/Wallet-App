import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Modal, TextInput, Platform, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from '../../constants/theme';
import { Target, Plus, Menu, Pencil, Trash2, Calendar, X, Clock, PiggyBank, RefreshCw } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import styles from './styles';
import { generateNotifications } from '../../services/notificationService';

const SavingsGoals = () => {
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCurrency, setUserCurrency] = useState('PKR');

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentGoal, setCurrentGoal] = useState(null);
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [targetDate, setTargetDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [repeatBasis, setRepeatBasis] = useState('none');
  const [repeatValue, setRepeatValue] = useState('0');

  // Contribution modal
  const [showContribModal, setShowContribModal] = useState(false);
  const [contribGoal, setContribGoal] = useState(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribSaving, setContribSaving] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchGoals = async () => {
    try {
      setLoading(true);
      if (!userId) return;
      const [{ data, error }, profileRes] = await Promise.all([
        supabase.from('savings_goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('users').select('currency').eq('id', userId).single(),
      ]);
      if (error) throw error;
      setGoals(data || []);
      setUserCurrency(profileRes.data?.currency || 'PKR');
    } catch (error) {
      console.error('Error fetching goals:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchGoals(); }, [userId]));

  // Realtime: update instantly when savings_goals change
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`goals_realtime_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_goals', filter: `user_id=eq.${userId}` },
        () => fetchGoals()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── Goal CRUD ──────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setCurrentGoal(null);
    setTitle('');
    setTargetAmount('');
    setStartDate(new Date());
    setTargetDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    setRepeatBasis('none');
    setRepeatValue('0');
    setShowModal(true);
  };

  const openEditModal = (goal) => {
    setCurrentGoal(goal);
    setTitle(goal.title);
    setTargetAmount(goal.target_amount.toString());
    setStartDate(goal.start_date ? new Date(goal.start_date) : new Date());
    setTargetDate(goal.target_date ? new Date(goal.target_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    setRepeatBasis(goal.repeat_basis || 'none');
    setRepeatValue(goal.repeat_value ? goal.repeat_value.toString() : '0');
    setShowModal(true);
  };

  const handleSaveGoal = async () => {
    if (!title.trim() || !targetAmount) {
      Alert.alert('Missing Fields', 'Please enter a title and target amount.');
      return;
    }
    try {
      setSaving(true);
      const goalData = {
        user_id: userId,
        title: title.trim(),
        target_amount: parseFloat(targetAmount),
        start_date: startDate.toISOString(),
        target_date: targetDate.toISOString(),
        repeat_basis: repeatBasis,
        repeat_value: parseInt(repeatValue) || 0,
      };
      const { error } = currentGoal
        ? await supabase.from('savings_goals').update(goalData).eq('id', currentGoal.id)
        : await supabase.from('savings_goals').insert(goalData);
      if (error) throw error;
      setShowModal(false);
      fetchGoals();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = (goal) => {
    Alert.alert('Delete Goal', `Delete "${goal.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('savings_goals').delete().eq('id', goal.id);
          if (error) Alert.alert('Error', error.message);
          else fetchGoals();
        }
      }
    ]);
  };

  // ── Contribution (add to saved_amount) ────────────────────────────────────

  const openContribModal = (goal) => {
    setContribGoal(goal);
    setContribAmount('');
    setShowContribModal(true);
  };

  const handleAddContribution = async () => {
    const amount = parseFloat(contribAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid contribution amount.');
      return;
    }
    try {
      setContribSaving(true);
      const currentSaved = parseFloat(contribGoal.saved_amount || 0);
      const newSaved = currentSaved + amount;
      const isComplete = newSaved >= parseFloat(contribGoal.target_amount);

      const { error } = await supabase
        .from('savings_goals')
        .update({ saved_amount: newSaved })
        .eq('id', contribGoal.id);
      if (error) throw error;

      setShowContribModal(false);
      fetchGoals();
      // Generate milestone / goal notifications after a contribution
      generateNotifications(userId).catch(() => {});

      if (isComplete) {
        Alert.alert('🎉 Goal Reached!', `Congratulations! You've reached your "${contribGoal.title}" goal!`);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setContribSaving(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatDate = (date) => date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

  const daysRemaining = (goal) => {
    if (!goal.target_date) return null;
    const diff = new Date(goal.target_date) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const dailyNeeded = (goal) => {
    const days = daysRemaining(goal);
    if (!days || days === 0) return null;
    const remaining = parseFloat(goal.target_amount) - parseFloat(goal.saved_amount || 0);
    if (remaining <= 0) return null;
    return (remaining / days).toFixed(0);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={[styles.iconButton, { marginRight: 16 }]} onPress={openDrawer}>
            <Menu color={COLORS.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Savings Goals</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.iconButton} onPress={fetchGoals}>
            <RefreshCw color={COLORS.text} size={18} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={openAddModal}>
            <Plus color={COLORS.text} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : goals.length > 0 ? (
          goals.map((goal) => {
            const saved = parseFloat(goal.saved_amount || 0);
            const target = parseFloat(goal.target_amount);
            const pct = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
            const barColor = pct >= 100 ? COLORS.success : pct >= 75 ? COLORS.warning : COLORS.accent;
            const days = daysRemaining(goal);
            const daily = dailyNeeded(goal);

            return (
              <View key={goal.id} style={styles.goalCard}>
                {/* Header Row */}
                <View style={styles.goalHeader}>
                  <View style={[styles.goalIconContainer, { backgroundColor: barColor + '22' }]}>
                    <Target color={barColor} size={24} />
                  </View>
                  <View style={styles.goalInfo}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={[styles.goalTitle, { flex: 1, marginRight: 8 }]}>{goal.title}</Text>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity onPress={() => openEditModal(goal)}>
                          <Pencil color={COLORS.textSecondary} size={17} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteGoal(goal)}>
                          <Trash2 color={COLORS.error} size={17} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.goalAmount}>
                      {userCurrency} {saved.toLocaleString()} / {userCurrency} {target.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                  </View>
                  <Text style={[styles.progressText, { color: barColor }]}>{pct.toFixed(1)}%</Text>
                </View>

                {/* Meta Row */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
                  {goal.target_date && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Calendar color={COLORS.textSecondary} size={13} />
                      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginLeft: 4 }}>
                        {days !== null ? `${days} days left` : new Date(goal.target_date).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                  {daily && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Clock color={COLORS.textSecondary} size={13} />
                      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginLeft: 4 }}>
                        {userCurrency} {parseInt(daily).toLocaleString()}/day needed
                      </Text>
                    </View>
                  )}
                  {goal.repeat_basis !== 'none' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <RefreshCw color={COLORS.textSecondary} size={13} />
                      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginLeft: 4 }}>
                        Repeats {goal.repeat_basis}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Add Contribution Button */}
                {pct < 100 && (
                  <TouchableOpacity
                    style={{
                      marginTop: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: barColor + '22',
                      borderRadius: 10,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: barColor + '44',
                    }}
                    onPress={() => openContribModal(goal)}
                  >
                    <PiggyBank color={barColor} size={16} />
                    <Text style={{ color: barColor, fontWeight: '700', fontSize: 13, marginLeft: 8 }}>
                      Add Savings
                    </Text>
                  </TouchableOpacity>
                )}

                {pct >= 100 && (
                  <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: COLORS.success, fontWeight: '700', fontSize: 14 }}>🎉 Goal Reached!</Text>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Target color={COLORS.textSecondary} size={48} style={{ marginBottom: 16 }} />
            <Text style={styles.emptyStateTitle}>No Goals Yet</Text>
            <Text style={styles.emptyStateText}>Tap + to create your first saving goal.</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Add/Edit Goal Modal ─────────────────────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={{ backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: 'bold' }}>
                {currentGoal ? 'Edit Goal' : 'New Saving Goal'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={{ padding: 4 }}>
                <X color={COLORS.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <Text style={labelStyle}>Goal Title</Text>
              <TextInput style={inputStyle} placeholder="e.g. New Laptop" placeholderTextColor="rgba(255,255,255,0.25)" value={title} onChangeText={setTitle} />

              <Text style={labelStyle}>Target Amount ({userCurrency})</Text>
              <TextInput style={inputStyle} placeholder="0.00" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="decimal-pad" value={targetAmount} onChangeText={setTargetAmount} />

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Start Date</Text>
                  <TouchableOpacity style={dateBtnStyle} onPress={() => setShowStartPicker(true)}>
                    <Calendar color={COLORS.primary} size={15} />
                    <Text style={{ color: COLORS.text, marginLeft: 8, fontSize: 13 }}>{formatDate(startDate)}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Target Date</Text>
                  <TouchableOpacity style={dateBtnStyle} onPress={() => setShowTargetPicker(true)}>
                    <Calendar color={COLORS.accent} size={15} />
                    <Text style={{ color: COLORS.text, marginLeft: 8, fontSize: 13 }}>{formatDate(targetDate)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {showStartPicker && (
                <DateTimePicker value={startDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} textColor={COLORS.text}
                  onChange={(e, d) => { setShowStartPicker(Platform.OS === 'ios'); if (d) setStartDate(d); }} />
              )}
              {showTargetPicker && (
                <DateTimePicker value={targetDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} textColor={COLORS.text} minimumDate={startDate}
                  onChange={(e, d) => { setShowTargetPicker(Platform.OS === 'ios'); if (d) setTargetDate(d); }} />
              )}

              <Text style={labelStyle}>Repeat</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {['none', 'daily', 'weekly', 'monthly', 'custom'].map(b => (
                  <TouchableOpacity key={b}
                    style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: repeatBasis === b ? COLORS.primary : COLORS.background, borderWidth: 1, borderColor: repeatBasis === b ? COLORS.primary : 'rgba(255,255,255,0.1)' }}
                    onPress={() => setRepeatBasis(b)}>
                    <Text style={{ color: repeatBasis === b ? COLORS.text : COLORS.textSecondary, fontSize: 13 }}>
                      {b.charAt(0).toUpperCase() + b.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {repeatBasis === 'custom' && (
                <>
                  <Text style={labelStyle}>Repeat Every (Days)</Text>
                  <TextInput style={inputStyle} placeholder="e.g. 3" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="number-pad" value={repeatValue} onChangeText={setRepeatValue} />
                </>
              )}

              <TouchableOpacity
                style={{ backgroundColor: COLORS.accent, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8, opacity: saving ? 0.7 : 1 }}
                onPress={handleSaveGoal} disabled={saving}>
                {saving ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>{currentGoal ? 'Update Goal' : 'Create Goal'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Contribution Modal ──────────────────────────────────────────────── */}
      <Modal visible={showContribModal} transparent animationType="fade" onRequestClose={() => setShowContribModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={{ backgroundColor: COLORS.card, borderRadius: 24, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View>
                <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: 'bold' }}>Add Savings</Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                  {contribGoal?.title}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowContribModal(false)}>
                <X color={COLORS.text} size={22} />
              </TouchableOpacity>
            </View>

            {contribGoal && (
              <View style={{ backgroundColor: COLORS.background, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>Current Progress</Text>
                <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 4 }}>
                  {userCurrency} {parseFloat(contribGoal.saved_amount || 0).toLocaleString()} / {userCurrency} {parseFloat(contribGoal.target_amount).toLocaleString()}
                </Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {userCurrency} {(parseFloat(contribGoal.target_amount) - parseFloat(contribGoal.saved_amount || 0)).toLocaleString()} remaining
                </Text>
              </View>
            )}

            <Text style={labelStyle}>Amount to Add ({userCurrency})</Text>
            <TextInput
              style={[inputStyle, { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }]}
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="decimal-pad"
              value={contribAmount}
              onChangeText={setContribAmount}
              autoFocus
            />

            <TouchableOpacity
              style={{ backgroundColor: COLORS.accent, padding: 16, borderRadius: 14, alignItems: 'center', opacity: contribSaving ? 0.7 : 1 }}
              onPress={handleAddContribution} disabled={contribSaving}>
              {contribSaving ? <ActivityIndicator color="#000" /> : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <PiggyBank color="#000" size={18} />
                  <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Record Savings</Text>
                </View>
              )}
            </TouchableOpacity>
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
const dateBtnStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: COLORS.background,
  borderRadius: 12,
  padding: 14,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
};

export default SavingsGoals;
