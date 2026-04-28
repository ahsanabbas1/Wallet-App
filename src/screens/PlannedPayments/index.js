import React, { useState, useCallback, useMemo } from 'react';
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
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarClock,
  Plus,
  ArrowLeft,
  Clock,
  Calendar as CalendarIcon,
  Repeat,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useTheme } from '../../context/ThemeContext';

import MiniCalendar from '../../components/Calendar';
import AppButton from '../../components/Common/AppButton';
import AppInput from '../../components/Common/AppInput';
import PaymentCard from '../../components/PaymentCard';
import { paymentService } from '../../services/paymentService';
import { transactionService } from '../../services/transactionService';
import { makeStyles } from './styles';

const INITIAL_FREQUENCY = 'monthly';

const buildDefaultForm = () => ({
  title: '',
  amount: '',
  type: 'expense',
  frequency: INITIAL_FREQUENCY,
  customDays: '3',
  nextDate: paymentService.formatLocalDate(new Date()),
});

const PlannedPayments = () => {
  const navigation = useNavigation();
  const { userId } = useAuth();
  const { currency } = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [plannedPayments, setPlannedPayments] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [recordingId, setRecordingId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [fetchingCategories, setFetchingCategories] = useState(false);

  const [tableExists, setTableExists] = useState(true);
  const [form, setForm] = useState(buildDefaultForm());

  const fetchPlannedPayments = async () => {
    try {
      setLoading(true);
      setTableExists(true);
      if (!userId) return;

      const data = await paymentService.getPlannedPayments(userId);
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

  const fetchCategories = async () => {
    if (!userId) return;
    try {
      setFetchingCategories(true);
      const data = await transactionService.getCategories(userId);
      if (data && data.length > 0) {
        const filtered = data.filter(c => c.type === form.type || c.type === 'both');
        setCategories(data);
        setSelectedCategory(filtered[0] || null);
      }
    } catch (error) {
      console.error('Error fetching categories:', error.message);
    } finally {
      setFetchingCategories(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPlannedPayments();
    }, [userId])
  );

  useFocusEffect(
    useCallback(() => {
      if (showAddModal) {
        fetchCategories();
      }
    }, [showAddModal, form.type, userId])
  );

  const resetForm = () => {
    setForm(buildDefaultForm());
    setShowCalendar(false);
    setSelectedCategory(null);
  };

  const updateFormField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'type') {
      const filtered = categories.filter(c => c.type === value || c.type === 'both');
      setSelectedCategory(filtered[0] || null);
    }
  };

  const handleAddPlanned = async () => {
    const { title, amount, type, frequency, customDays, nextDate } = form;

    if (!title.trim() || !amount) {
      Alert.alert('Missing Fields', 'Please enter a title and amount.');
      return;
    }

    if (!nextDate || !paymentService.parseLocalDate(nextDate)) {
      Alert.alert('Invalid Date', 'Please choose a valid next due date.');
      return;
    }

    if (frequency === 'custom' && (!customDays || Number(customDays) <= 0)) {
      Alert.alert('Custom Interval', 'Enter how many days should pass before this payment repeats.');
      return;
    }

    try {
      setSubmitting(true);
      await paymentService.addPlannedPayment({
        user_id: userId,
        title: title.trim(),
        amount: parseFloat(amount),
        type,
        frequency,
        custom_days: customDays,
        next_date: nextDate,
        category_id: selectedCategory?.id || null,
      });

      setShowAddModal(false);
      resetForm();
      fetchPlannedPayments();
    } catch (error) {
      Alert.alert('Error', `Could not add payment. ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordNow = async (item) => {
    try {
      setRecordingId(item.id);
      await paymentService.recordPlannedPaymentNow(item);
      await fetchPlannedPayments();
      Alert.alert('Payment Recorded', 'This planned payment was added to your ledger and the next due date was advanced.');
    } catch (error) {
      Alert.alert('Error', `Could not record payment. ${error.message}`);
    } finally {
      setRecordingId(null);
    }
  };

  const deletePlanned = async (id) => {
    try {
      await paymentService.deletePlannedPayment(id);
      fetchPlannedPayments();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const frequencyOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'custom', label: 'Custom' },
  ];

  const customFrequencyPreview = form.frequency === 'custom'
    ? paymentService.getFrequencyLabel(paymentService.normalizeFrequency('custom', form.customDays))
    : paymentService.getFrequencyLabel(form.frequency);

  return (
    <SafeAreaView style={styles.container}>
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
          <Text style={styles.infoText}>
            Set bills, subscriptions, and repeating income here. Due payments record into the ledger and move their next due date forward.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
        ) : !tableExists ? (
          <View style={[styles.emptyState, { backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 24, padding: 32 }]}>
            <Clock color={COLORS.error} size={48} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyTitle, { color: COLORS.error }]}>Table Not Found</Text>
            <Text style={styles.emptySub}>The `planned_payments` table has not been created in Supabase yet.</Text>
            <AppButton title="Check Again" onPress={fetchPlannedPayments} style={{ backgroundColor: COLORS.error, marginTop: 16 }} />
          </View>
        ) : plannedPayments.length > 0 ? (
          plannedPayments.map((item) => (
            <PaymentCard
              key={item.id}
              item={item}
              onDelete={deletePlanned}
              onRecord={recordingId ? undefined : handleRecordNow}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <CalendarClock color={COLORS.textSecondary} size={64} style={{ opacity: 0.3, marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>No Planned Payments</Text>
            <Text style={styles.emptySub}>Add your first repeating bill or salary.</Text>
            <AppButton title="Add Planned Payment" onPress={() => setShowAddModal(true)} style={{ paddingHorizontal: 30 }} />
          </View>
        )}
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Planned Payment</Text>
                <Pressable
                  onPress={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                >
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
                  label={`Amount (${currency})`}
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

                {/* Category Selector */}
                <View style={{ marginBottom: 20, marginTop: 10 }}>
                  <Text style={styles.label}>Category (Optional)</Text>
                  {fetchingCategories ? (
                    <ActivityIndicator color={COLORS.primary} size="small" style={{ marginVertical: 12 }} />
                  ) : (
                    <View style={styles.categoryList}>
                      {categories
                        .filter(c => c.type === form.type || c.type === 'both')
                        .map((cat) => (
                          <Pressable
                            key={cat.id}
                            style={[
                              styles.categoryChip,
                              selectedCategory?.id === cat.id && styles.activeChip,
                            ]}
                            onPress={() => setSelectedCategory(cat)}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                selectedCategory?.id === cat.id && styles.activeChipText,
                              ]}
                            >
                              {cat.name}
                            </Text>
                          </Pressable>
                        ))}
                    </View>
                  )}
                </View>

                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <Repeat color={COLORS.primary} size={16} />
                    <Text style={styles.label}>Repeat</Text>
                  </View>
                  <View style={[styles.row, { flexWrap: 'wrap' }]}>
                    {frequencyOptions.map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() => updateFormField('frequency', option.value)}
                        style={[styles.smallChip, form.frequency === option.value && styles.activeChip]}
                      >
                        <Text style={[styles.smallChipText, form.frequency === option.value && styles.activeChipText]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {form.frequency === 'custom' ? (
                    <AppInput
                      label="Repeat Every (Days)"
                      keyboardType="number-pad"
                      placeholder="e.g. 3"
                      value={form.customDays}
                      onChangeText={(val) => updateFormField('customDays', val.replace(/[^0-9]/g, ''))}
                    />
                  ) : null}

                  <Text style={styles.helperText}>Schedule: {customFrequencyPreview}</Text>
                </View>

                <View style={styles.sectionBlock}>
                  <Text style={styles.label}>Next Due Date</Text>
                  <View style={styles.dateInputWrapper}>
                    <AppInput
                      placeholder="2026-04-28"
                      value={form.nextDate}
                      onChangeText={(val) => updateFormField('nextDate', val)}
                      containerStyle={{ flex: 1, marginBottom: 0 }}
                      style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                    />
                    <Pressable onPress={() => setShowCalendar(!showCalendar)} style={styles.calendarTrigger}>
                      <CalendarIcon color={COLORS.primary} size={20} />
                    </Pressable>
                  </View>

                  <Text style={styles.helperText}>
                    Selected: {paymentService.parseLocalDate(form.nextDate)?.toLocaleDateString() || 'No date'}
                  </Text>

                  {showCalendar ? (
                    <MiniCalendar
                      selectedDate={form.nextDate}
                      onSelectDate={(date) => {
                        updateFormField('nextDate', date);
                        setShowCalendar(false);
                      }}
                    />
                  ) : null}
                </View>

                <AppButton title="Add Planned Payment" onPress={handleAddPlanned} loading={submitting} style={{ marginTop: 24 }} />
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default PlannedPayments;
