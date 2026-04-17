import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable, 
  ActivityIndicator, 
  Alert, 
  Modal, 
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { 
  CalendarClock, 
  Plus, 
  ArrowLeft, 
  Clock, 
  Calendar as CalendarIcon 
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

// Modular Components
import MiniCalendar from '../../components/Calendar';
import AppButton from '../../components/Common/AppButton';
import AppInput from '../../components/Common/AppInput';
import PaymentCard from './components/PaymentCard';

// Services
import { paymentService } from '../../services/paymentService';

import styles from './styles';

const PlannedPayments = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [plannedPayments, setPlannedPayments] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Table status
  const [tableExists, setTableExists] = useState(true);

  // Form State
  const [form, setForm] = useState({
    title: '',
    amount: '',
    type: 'expense',
    frequency: 'monthly',
    nextDate: new Date().toISOString().split('T')[0]
  });

  const fetchPlannedPayments = async () => {
    try {
      setLoading(true);
      setTableExists(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const data = await paymentService.getPlannedPayments(session.user.id);
      setPlannedPayments(data);
    } catch (error) {
      if (error.message.includes('relation "planned_payments" does not exist')) {
        setTableExists(false);
      } else {
        console.error('Error fetching planned payments:', error.message);
      }
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
    const { title, amount, type, frequency, nextDate } = form;

    if (!title || !amount) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    try {
      setSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      await paymentService.addPlannedPayment({
        user_id: session.user.id,
        title,
        amount: parseFloat(amount),
        type,
        frequency,
        next_date: nextDate,
        status: 'active'
      });
      
      setShowAddModal(false);
      resetForm();
      fetchPlannedPayments();
    } catch (error) {
      Alert.alert('Error', 'Could not add payment. Error: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      title: '',
      amount: '',
      type: 'expense',
      frequency: 'monthly',
      nextDate: new Date().toISOString().split('T')[0]
    });
  };

  const deletePlanned = async (id) => {
    try {
      await paymentService.deletePlannedPayment(id);
      fetchPlannedPayments();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const updateFormField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
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
            <Text style={styles.emptySub}>The 'planned_payments' table hasn't been created in Supabase yet.</Text>
            <AppButton 
              title="Check Again" 
              onPress={fetchPlannedPayments} 
              style={{ backgroundColor: COLORS.error, marginTop: 16 }} 
            />
          </View>
        ) : plannedPayments.length > 0 ? (
          plannedPayments.map((item) => (
            <PaymentCard key={item.id} item={item} onDelete={deletePlanned} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <CalendarClock color={COLORS.textSecondary} size={64} style={{ opacity: 0.3, marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>No Planned Payments</Text>
            <Text style={styles.emptySub}>Add your first repeating bill or salary.</Text>
            <AppButton 
              title="Add Planned Payment" 
              onPress={() => setShowAddModal(true)} 
              style={{ paddingHorizontal: 30 }}
            />
          </View>
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Planned Payment</Text>
                <Pressable onPress={() => setShowAddModal(false)}>
                  <Text style={{ color: COLORS.textSecondary }}>Cancel</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
                <AppInput 
                  label="Title"
                  placeholder="e.g. House Rent or Salary" 
                  value={form.title}
                  onChangeText={(val) => updateFormField('title', val)}
                />

                <AppInput 
                  label="Amount (PKR)"
                  keyboardType="numeric" 
                  placeholder="0.00" 
                  value={form.amount}
                  onChangeText={(val) => updateFormField('amount', val)}
                />

                <Text style={styles.label}>Type</Text>
                <View style={styles.row}>
                  <Pressable 
                    onPress={() => updateFormField('type', 'expense')}
                    style={[styles.chip, form.type === 'expense' && styles.activeChip]}
                  >
                    <Text style={[styles.chipText, form.type === 'expense' && styles.activeChipText]}>Expense</Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => updateFormField('type', 'income')}
                    style={[styles.chip, form.type === 'income' && styles.activeChip]}
                  >
                    <Text style={[styles.chipText, form.type === 'income' && styles.activeChipText]}>Income</Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>Frequency</Text>
                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                  {['daily', 'weekly', 'monthly', 'yearly'].map(f => (
                    <Pressable 
                      key={f}
                      onPress={() => updateFormField('frequency', f)}
                      style={[styles.smallChip, form.frequency === f && styles.activeChip]}
                    >
                      <Text style={[styles.smallChipText, form.frequency === f && styles.activeChipText]}>{f}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Next Due Date</Text>
                <View style={styles.dateInputWrapper}>
                  <AppInput 
                    placeholder="2024-05-01" 
                    value={form.nextDate}
                    onChangeText={(val) => updateFormField('nextDate', val)}
                    containerStyle={{ flex: 1, marginBottom: 0 }}
                    style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                  />
                  <Pressable 
                    onPress={() => setShowCalendar(!showCalendar)} 
                    style={styles.calendarTrigger}
                  >
                    <CalendarIcon color={COLORS.primary} size={20} />
                  </Pressable>
                </View>

                {showCalendar && (
                  <MiniCalendar 
                    selectedDate={form.nextDate} 
                    onSelectDate={(date) => {
                      updateFormField('nextDate', date);
                      setShowCalendar(false);
                    }} 
                  />
                )}

                <AppButton 
                  title="Add Planned Payment" 
                  onPress={handleAddPlanned}
                  loading={submitting}
                  style={{ marginTop: 30 }}
                />
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default PlannedPayments;

