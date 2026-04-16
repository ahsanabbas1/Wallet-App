import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Modal, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';
import { CalendarClock, Plus, Filter, ArrowLeft, Trash2, ChevronRight, Clock, Tag, DollarSign, Calendar as CalendarIcon, ChevronLeft } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import styles from './styles';

const PlannedPayments = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [plannedPayments, setPlannedPayments] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [frequency, setFrequency] = useState('monthly');
  const [nextDate, setNextDate] = useState(new Date().toISOString().split('T')[0]);

  const [tableExists, setTableExists] = useState(true);
  
  const fetchPlannedPayments = async () => {
    try {
      setLoading(true);
      setTableExists(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('planned_payments')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) {
        if (error.message.includes('relation "planned_payments" does not exist') || error.message.includes('schema cache')) {
          setTableExists(false);
          setPlannedPayments([]);
        } else {
          throw error;
        }
      } else {
        setPlannedPayments(data || []);
      }
    } catch (error) {
      console.error('Error fetching planned payments:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPlannedPayments();
    }, [])
  );

  const handleAddPlanned = async () => {
    if (!title || !amount) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from('planned_payments')
        .insert({
          user_id: session.user.id,
          title,
          amount: parseFloat(amount),
          type,
          frequency,
          next_date: nextDate,
          status: 'active'
        });

      if (error) throw error;
      
      setShowAddModal(false);
      resetForm();
      fetchPlannedPayments();
    } catch (error) {
      Alert.alert('Error', 'Ensure you have created the "planned_payments" table in Supabase. Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setType('expense');
    setFrequency('monthly');
    setNextDate(new Date().toISOString().split('T')[0]);
  };

  const deletePlanned = async (id) => {
    try {
      const { error } = await supabase
        .from('planned_payments')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchPlannedPayments();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Simple Mini Calendar implementation
  const MiniCalendar = () => {
    const now = new Date();
    const [viewDate, setViewDate] = useState(new Date(nextDate));
    
    const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();
    
    const month = viewDate.getMonth();
    const year = viewDate.getFullYear();
    const days = daysInMonth(month, year);
    const firstDay = firstDayOfMonth(month, year);
    
    const calendarDays = [];
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let i = 1; i <= days; i++) calendarDays.push(i);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const selectDate = (day) => {
      const newDate = new Date(year, month, day);
      setNextDate(newDate.toISOString().split('T')[0]);
      setShowCalendar(false);
    };

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <Pressable onPress={() => setViewDate(new Date(year, month - 1, 1))}>
            <ChevronLeft color={COLORS.text} size={20} />
          </Pressable>
          <Text style={styles.calendarTitle}>{monthNames[month]} {year}</Text>
          <Pressable onPress={() => setViewDate(new Date(year, month + 1, 1))}>
            <ChevronRight color={COLORS.text} size={20} />
          </Pressable>
        </View>
        <View style={styles.calendarGrid}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
            <Text key={idx} style={styles.calendarDayHeader}>{d}</Text>
          ))}
          {calendarDays.map((d, index) => (
            <Pressable 
              key={index} 
              onPress={() => d && selectDate(d)}
              style={[
                styles.calendarDay, 
                d && d.toString() === nextDate.split('-')[2] && parseInt(nextDate.split('-')[1]) === month + 1 && styles.calendarDaySelected
              ]}
            >
              <Text style={[styles.calendarDayText, !d && { opacity: 0 }]}>{d}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={COLORS.text} size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Planned Payments</Text>
        <Pressable onPress={() => setShowAddModal(true)} style={styles.addButton}>
          <Plus color={COLORS.primary} size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <Clock color={COLORS.primary} size={20} />
          <Text style={styles.infoText}>Manage your upcoming bills, subscriptions, and repeating income here.</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
        ) : !tableExists ? (
          <View style={[styles.emptyState, { backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 24, padding: 32 }]}>
            <Clock color={COLORS.error} size={48} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyTitle, { color: COLORS.error }]}>Table Not Found</Text>
            <Text style={styles.emptySub}>The 'planned_payments' table hasn't been created in Supabase yet. Please run the SQL script in your Supabase dashboard.</Text>
            <Pressable style={[styles.emptyButton, { backgroundColor: COLORS.error }]} onPress={fetchPlannedPayments}>
              <Text style={styles.emptyButtonText}>Check Again</Text>
            </Pressable>
          </View>
        ) : plannedPayments.length > 0 ? (
          plannedPayments.map((item) => (
            <View key={item.id} style={styles.paymentCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: item.type === 'income' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)' }]}>
                  <CalendarClock color={item.type === 'income' ? COLORS.success || '#4caf50' : COLORS.error} size={20} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSub}>{item.frequency.toUpperCase()} • Next: {new Date(item.next_date).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.cardAmount, { color: item.type === 'income' ? COLORS.success || '#4caf50' : COLORS.text }]}>
                  {item.type === 'income' ? '+' : '-'}PKR {item.amount.toLocaleString()}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <Pressable onPress={() => deletePlanned(item.id)} style={styles.deleteButton}>
                  <Trash2 color={COLORS.error} size={18} />
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <CalendarClock color={COLORS.textSecondary} size={64} style={{ opacity: 0.3, marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>No Planned Payments</Text>
            <Text style={styles.emptySub}>Add your first repeating bill or salary.</Text>
            <Pressable style={styles.emptyButton} onPress={() => setShowAddModal(true)}>
              <Text style={styles.emptyButtonText}>Add Planned Payment</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Planned Payment</Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Text style={{ color: COLORS.textSecondary }}>Cancel</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Title</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. House Rent or Salary" 
                placeholderTextColor={COLORS.textSecondary}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>Amount (PKR)</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric" 
                placeholder="0.00" 
                placeholderTextColor={COLORS.textSecondary}
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={styles.label}>Type</Text>
              <View style={styles.row}>
                <Pressable 
                  onPress={() => setType('expense')}
                  style={[styles.chip, type === 'expense' && styles.activeChip]}
                >
                  <Text style={[styles.chipText, type === 'expense' && styles.activeChipText]}>Expense</Text>
                </Pressable>
                <Pressable 
                  onPress={() => setType('income')}
                  style={[styles.chip, type === 'income' && styles.activeChip]}
                >
                  <Text style={[styles.chipText, type === 'income' && styles.activeChipText]}>Income</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Frequency</Text>
              <View style={[styles.row, { flexWrap: 'wrap' }]}>
                {['daily', 'weekly', 'monthly', 'yearly'].map(f => (
                  <Pressable 
                    key={f}
                    onPress={() => setFrequency(f)}
                    style={[styles.smallChip, frequency === f && styles.activeChip]}
                  >
                    <Text style={[styles.smallChipText, frequency === f && styles.activeChipText]}>{f}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Next Due Date</Text>
              <View style={styles.dateInputWrapper}>
                <TextInput 
                  style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]} 
                  placeholder="2024-05-01" 
                  placeholderTextColor={COLORS.textSecondary}
                  value={nextDate}
                  onChangeText={setNextDate}
                />
                <Pressable 
                  onPress={() => setShowCalendar(!showCalendar)} 
                  style={styles.calendarTrigger}
                >
                  <CalendarIcon color={COLORS.primary} size={20} />
                </Pressable>
              </View>

              {showCalendar && <MiniCalendar />}

              <Pressable style={styles.saveButton} onPress={handleAddPlanned}>
                <Text style={styles.saveButtonText}>Add Planned Payment</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default PlannedPayments;
