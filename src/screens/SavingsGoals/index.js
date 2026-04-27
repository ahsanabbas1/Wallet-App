import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Modal, TextInput, Platform, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from '../../constants/theme';
import { Target, Plus, Menu, Pencil, Trash2, Calendar, X, Clock } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import styles from './styles';

const SavingsGoals = () => {
  const navigation = useNavigation();
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const fetchGoals = async () => {
    try {
      setLoading(true);
      if (!userId) return;
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error('Error fetching savings goals:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = () => {
    setCurrentGoal(null);
    setTitle('');
    setTargetAmount('');
    setStartDate(new Date());
    setTargetDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    setRepeatBasis('none');
    setRepeatValue('0');
    setShowModal(true);
  };

  const handleEditGoal = (goal) => {
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
      if (!userId) return;

      const goalData = {
        user_id: userId,
        title: title.trim(),
        target_amount: parseFloat(targetAmount),
        start_date: startDate.toISOString(),
        target_date: targetDate.toISOString(),
        repeat_basis: repeatBasis,
        repeat_value: parseInt(repeatValue) || 0,
      };

      let error;
      if (currentGoal) {
        ({ error } = await supabase.from('savings_goals').update(goalData).eq('id', currentGoal.id));
      } else {
        ({ error } = await supabase.from('savings_goals').insert(goalData));
      }

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
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('savings_goals').delete().eq('id', goal.id);
          if (error) Alert.alert('Error', error.message);
          else fetchGoals();
        },
      },
    ]);
  };

  useFocusEffect(useCallback(() => { fetchGoals(); }, []));

  const formatDate = (date) => date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={[styles.iconButton, { marginRight: 16 }]} onPress={openDrawer}>
            <Menu color={COLORS.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Savings Goals</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={handleAddGoal}>
          <Plus color={COLORS.text} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : goals.length > 0 ? (
          goals.map((goal) => {
            const pct = goal.target_amount > 0
              ? Math.min((parseFloat(goal.saved_amount || 0) / parseFloat(goal.target_amount)) * 100, 100)
              : 0;
            const barColor = pct >= 100 ? COLORS.success : pct >= 75 ? COLORS.warning : COLORS.accent;
            return (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={[styles.goalIconContainer, { backgroundColor: barColor + '22' }]}>
                    <Target color={barColor} size={24} />
                  </View>
                  <View style={styles.goalInfo}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.goalTitle}>{goal.title}</Text>
                      <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity onPress={() => handleEditGoal(goal)} style={{ marginRight: 12 }}>
                          <Pencil color={COLORS.textSecondary} size={18} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteGoal(goal)}>
                          <Trash2 color={COLORS.error} size={18} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.goalAmount}>
                      PKR {parseFloat(goal.saved_amount || 0).toLocaleString()} / PKR {parseFloat(goal.target_amount || 0).toLocaleString()}
                    </Text>
                    {goal.target_date && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Calendar color={COLORS.textSecondary} size={12} />
                        <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginLeft: 4 }}>
                          Target: {new Date(goal.target_date).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                  </View>
                  <Text style={[styles.progressText, { color: barColor }]}>{pct.toFixed(1)}%</Text>
                </View>

                <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
                  <Clock color={COLORS.textSecondary} size={14} />
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginLeft: 6 }}>
                    {goal.repeat_basis === 'none' ? 'One-time goal' : `Repeats: ${goal.repeat_basis}`}
                  </Text>
                </View>
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

      {/* Add/Edit Goal Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={{ backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' }}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: 'bold' }}>
                {currentGoal ? 'Edit Goal' : 'New Saving Goal'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={{ padding: 4 }}>
                <X color={COLORS.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              {/* Title */}
              <Text style={inputLabelStyle}>Goal Title</Text>
              <TextInput
                style={inputStyle}
                placeholder="e.g. New Laptop"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={title}
                onChangeText={setTitle}
              />

              {/* Target Amount */}
              <Text style={inputLabelStyle}>Target Amount (PKR)</Text>
              <TextInput
                style={inputStyle}
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="decimal-pad"
                value={targetAmount}
                onChangeText={setTargetAmount}
              />

              {/* Date Row */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={inputLabelStyle}>Start Date</Text>
                  <TouchableOpacity style={dateBtnStyle} onPress={() => setShowStartPicker(true)}>
                    <Calendar color={COLORS.primary} size={16} />
                    <Text style={{ color: COLORS.text, marginLeft: 8, fontSize: 14 }}>{formatDate(startDate)}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={inputLabelStyle}>Target Date</Text>
                  <TouchableOpacity style={dateBtnStyle} onPress={() => setShowTargetPicker(true)}>
                    <Calendar color={COLORS.accent} size={16} />
                    <Text style={{ color: COLORS.text, marginLeft: 8, fontSize: 14 }}>{formatDate(targetDate)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  textColor={COLORS.text}
                  onChange={(e, d) => { setShowStartPicker(Platform.OS === 'ios'); if (d) setStartDate(d); }}
                />
              )}
              {showTargetPicker && (
                <DateTimePicker
                  value={targetDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  textColor={COLORS.text}
                  minimumDate={startDate}
                  onChange={(e, d) => { setShowTargetPicker(Platform.OS === 'ios'); if (d) setTargetDate(d); }}
                />
              )}

              {/* Repeat Options */}
              <Text style={inputLabelStyle}>Repeat</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {['none', 'daily', 'weekly', 'monthly', 'custom'].map((basis) => (
                  <TouchableOpacity
                    key={basis}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: repeatBasis === basis ? COLORS.primary : COLORS.background,
                      borderWidth: 1,
                      borderColor: repeatBasis === basis ? COLORS.primary : 'rgba(255,255,255,0.1)',
                    }}
                    onPress={() => setRepeatBasis(basis)}
                  >
                    <Text style={{ color: repeatBasis === basis ? COLORS.text : COLORS.textSecondary, fontSize: 13 }}>
                      {basis.charAt(0).toUpperCase() + basis.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {repeatBasis === 'custom' && (
                <>
                  <Text style={inputLabelStyle}>Repeat Every (Days)</Text>
                  <TextInput
                    style={[inputStyle, { marginBottom: 16 }]}
                    placeholder="e.g. 3"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="number-pad"
                    value={repeatValue}
                    onChangeText={setRepeatValue}
                  />
                </>
              )}

              <TouchableOpacity
                style={{
                  backgroundColor: COLORS.accent,
                  padding: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  marginTop: 8,
                  opacity: saving ? 0.7 : 1,
                }}
                onPress={handleSaveGoal}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={COLORS.text} />
                  : <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>
                      {currentGoal ? 'Update Goal' : 'Create Goal'}
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

const inputLabelStyle = { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 };
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
