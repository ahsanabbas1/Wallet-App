import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { Target, Plus, Menu, Pencil, Trash2, Calendar, X, Clock } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import styles from './styles';
import { Modal, TextInput, ActivityIndicator as RNNActivityIndicator } from 'react-native';

const SavingsGoals = () => {
  const navigation = useNavigation();
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [currentGoal, setCurrentGoal] = useState(null);
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState('');
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
    setStartDate(new Date().toISOString().split('T')[0]);
    setTargetDate('');
    setRepeatBasis('none');
    setRepeatValue('0');
    setShowModal(true);
  };

  const handleEditGoal = (goal) => {
    setCurrentGoal(goal);
    setTitle(goal.title);
    setTargetAmount(goal.target_amount.toString());
    setStartDate(goal.start_date ? goal.start_date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setTargetDate(goal.target_date ? goal.target_date.split('T')[0] : '');
    setRepeatBasis(goal.repeat_basis || 'none');
    setRepeatValue(goal.repeat_value ? goal.repeat_value.toString() : '0');
    setShowModal(true);
  };

  const handleSaveGoal = async () => {
    if (!title || !targetAmount) {
      Alert.alert('Error', 'Please enter title and target amount.');
      return;
    }

    try {
      setSaving(true);
      if (!userId) return;

      const goalData = {
        user_id: userId,
        title,
        target_amount: parseFloat(targetAmount),
        start_date: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
        target_date: targetDate ? new Date(targetDate).toISOString() : null,
        repeat_basis: repeatBasis,
        repeat_value: parseInt(repeatValue) || 0,
      };

      let error;
      if (currentGoal) {
        ({ error } = await supabase
          .from('savings_goals')
          .update(goalData)
          .eq('id', currentGoal.id));
      } else {
        ({ error } = await supabase
          .from('savings_goals')
          .insert(goalData));
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
    Alert.alert(
      'Delete Goal',
      `Are you sure you want to delete "${goal.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('savings_goals')
                .delete()
                .eq('id', goal.id);
              if (error) throw error;
              fetchGoals();
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
      fetchGoals();
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            style={[styles.iconButton, { marginRight: 16 }]}
            onPress={openDrawer}
          >
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
            const percent = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
            return (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={styles.goalIconContainer}>
                    <Target color={COLORS.accent} size={24} />
                  </View>
                  <View style={styles.goalInfo}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.goalTitle}>{goal.title}</Text>
                      <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity onPress={() => handleEditGoal(goal)} style={{ marginRight: 10 }}>
                          <Pencil color={COLORS.textSecondary} size={18} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteGoal(goal)}>
                          <Trash2 color={COLORS.error} size={18} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.goalAmount}>PKR {parseFloat(goal.saved_amount || 0).toLocaleString()} / PKR {parseFloat(goal.target_amount || 0).toLocaleString()}</Text>
                    {goal.target_date && (
                      <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 4 }}>
                        Target: {new Date(goal.target_date).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(percent, 100)}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{percent.toFixed(1)}%</Text>
                </View>
                
                <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
                   <Clock color={COLORS.textSecondary} size={14} />
                   <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginLeft: 6 }}>
                     Repeat: {goal.repeat_basis === 'none' ? 'One-time' : goal.repeat_basis}
                   </Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Target color={COLORS.textSecondary} size={48} style={{ marginBottom: 16 }} />
            <Text style={styles.emptyStateTitle}>No Goals Yet</Text>
            <Text style={styles.emptyStateText}>Set a saving goal to track your progress.</Text>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Goal Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: COLORS.card, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, maxHeight: '90%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: 'bold' }}>{currentGoal ? 'Edit Goal' : 'New Saving Goal'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X color={COLORS.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={{ marginBottom: 15 }}>
                <Text style={{ color: COLORS.textSecondary, marginBottom: 8 }}>Goal Title</Text>
                <TextInput
                  style={{ backgroundColor: COLORS.background, color: COLORS.text, padding: 12, borderRadius: 10 }}
                  placeholder="e.g. New Laptop"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              <View style={{ marginBottom: 15 }}>
                <Text style={{ color: COLORS.textSecondary, marginBottom: 8 }}>Target Amount (PKR)</Text>
                <TextInput
                  style={{ backgroundColor: COLORS.background, color: COLORS.text, padding: 12, borderRadius: 10 }}
                  placeholder="0.00"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="decimal-pad"
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ color: COLORS.textSecondary, marginBottom: 8 }}>Start Date</Text>
                  <TextInput
                    style={{ backgroundColor: COLORS.background, color: COLORS.text, padding: 12, borderRadius: 10 }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={startDate}
                    onChangeText={setStartDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.textSecondary, marginBottom: 8 }}>Target Date</Text>
                  <TextInput
                    style={{ backgroundColor: COLORS.background, color: COLORS.text, padding: 12, borderRadius: 10 }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={targetDate}
                    onChangeText={setTargetDate}
                  />
                </View>
              </View>

              <View style={{ marginBottom: 15 }}>
                <Text style={{ color: COLORS.textSecondary, marginBottom: 8 }}>Repeat Options</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {['none', 'daily', 'weekly', 'monthly', 'custom'].map((basis) => (
                    <TouchableOpacity
                      key={basis}
                      style={{
                        paddingHorizontal: 15,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: repeatBasis === basis ? COLORS.primary : COLORS.background,
                        marginRight: 8,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: repeatBasis === basis ? COLORS.primary : 'rgba(255,255,255,0.1)'
                      }}
                      onPress={() => setRepeatBasis(basis)}
                    >
                      <Text style={{ color: COLORS.text, fontSize: 12 }}>{basis.charAt(0).toUpperCase() + basis.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {repeatBasis === 'custom' && (
                <View style={{ marginBottom: 15 }}>
                  <Text style={{ color: COLORS.textSecondary, marginBottom: 8 }}>Repeat Every (Days)</Text>
                  <TextInput
                    style={{ backgroundColor: COLORS.background, color: COLORS.text, padding: 12, borderRadius: 10 }}
                    placeholder="e.g. 3"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="number-pad"
                    value={repeatValue}
                    onChangeText={setRepeatValue}
                  />
                </View>
              )}

              <TouchableOpacity
                style={{
                  backgroundColor: COLORS.accent,
                  padding: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 10,
                  marginBottom: 30,
                  opacity: saving ? 0.7 : 1
                }}
                onPress={handleSaveGoal}
                disabled={saving}
              >
                {saving ? (
                  <RNNActivityIndicator color={COLORS.text} />
                ) : (
                  <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 16 }}>
                    {currentGoal ? 'Update Goal' : 'Create Goal'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default SavingsGoals;
