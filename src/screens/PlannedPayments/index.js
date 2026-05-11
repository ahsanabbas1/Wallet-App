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
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  CalendarClock,
  Plus,
  Menu,
  Clock,
  Calendar as CalendarIcon,
  Repeat,
  X,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useTheme } from '../../context/ThemeContext';
import { useDrawer } from '../../context/DrawerContext';

import AppButton from '../../components/Common/AppButton';
import AppInput from '../../components/Common/AppInput';
import PaymentCard from '../../components/PaymentCard';
import { paymentService } from '../../services/paymentService';
import { transactionService } from '../../services/transactionService';
import { makeStyles } from './styles';
import * as Icons from 'lucide-react-native';

const INITIAL_FREQUENCY = 'monthly';

const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const buildDefaultForm = () => {
  const now = new Date();
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  return {
    title:      '',
    amount:     '',
    type:       'expense',
    frequency:  INITIAL_FREQUENCY,
    customDays: '3',
    startDate:  paymentService.formatLocalDate(now),
    startTime:  '09:00',
    endDate:    null,
  };
};

const PlannedPayments = () => {
  const navigation = useNavigation();
  const { openDrawer } = useDrawer();
  const { userId }   = useAuth();
  const { currency } = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [loading,          setLoading]          = useState(true);
  const [submitting,       setSubmitting]        = useState(false);
  const [plannedPayments,  setPlannedPayments]   = useState([]);
  const [showAddModal,     setShowAddModal]      = useState(false);
  const [recordingId,      setRecordingId]       = useState(null);
  const [editingPayment,   setEditingPayment]    = useState(null);
  const [categories,       setCategories]        = useState([]);
  const [selectedCategory, setSelectedCategory]  = useState(null);
  const [activeParent,     setActiveParent]      = useState(null); // hierarchical parent selection
  const [fetchingCategories, setFetchingCategories] = useState(false);
  const [tableExists,      setTableExists]       = useState(true);
  const [form,             setForm]              = useState(buildDefaultForm());

  // Date/time picker state
  const [datePickerField,  setDatePickerField]   = useState(null); // 'start' | 'end' | 'time'
  const [showDatePicker,   setShowDatePicker]    = useState(false);

  /* ── Fetch ─────────────────────────────────────────────────────── */
  const fetchPlannedPayments = async () => {
    try {
      setLoading(true);
      setTableExists(true);
      if (!userId) return;
      const data = await paymentService.getPlannedPayments(userId);
      setPlannedPayments(data);
    } catch (error) {
      if (error.message?.includes('relation "planned_payments" does not exist')) {
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
      if (data?.length > 0) {
        setCategories(data);
        // Do NOT auto-select — user must explicitly choose a category
      }
    } catch (error) {
      console.error('Error fetching categories:', error.message);
    } finally {
      setFetchingCategories(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchPlannedPayments(); }, [userId]));
  useFocusEffect(useCallback(() => { if (showAddModal) fetchCategories(); }, [showAddModal, form.type, userId]));

  /* ── Form helpers ───────────────────────────────────────────────── */
  const resetForm = () => {
    setForm(buildDefaultForm());
    setSelectedCategory(null);
    setActiveParent(null);
    setEditingPayment(null);
  };

  const updateFormField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'type') {
      setSelectedCategory(null);
      setActiveParent(null);
    }
  };

  const openDatePicker = (field) => {
    setDatePickerField(field);
    setShowDatePicker(true);
  };

  const onDateChange = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    
    setShowDatePicker(Platform.OS === 'ios');
    if (!selectedDate) return;

    if (datePickerField === 'start') {
      updateFormField('startDate', paymentService.formatLocalDate(selectedDate));
    } else if (datePickerField === 'end') {
      updateFormField('endDate', paymentService.formatLocalDate(selectedDate));
    } else if (datePickerField === 'time') {
      const h = String(selectedDate.getHours()).padStart(2, '0');
      const m = String(selectedDate.getMinutes()).padStart(2, '0');
      updateFormField('startTime', `${h}:${m}`);
    }
  };

  /* ── Save (add or edit) ─────────────────────────────────────────── */
  const handleSavePayment = async () => {
    const { title, amount, type, frequency, customDays, startDate, endDate } = form;

    if (!title.trim())  return Alert.alert('Missing Title',  'Please enter a title.');
    if (!amount)        return Alert.alert('Missing Amount', 'Please enter an amount.');
    if (!startDate || !paymentService.parseLocalDate(startDate))
      return Alert.alert('Invalid Start Date', 'Please pick a valid start date.');
    
    if (endDate && paymentService.parseLocalDate(endDate)) {
      if (paymentService.parseLocalDate(endDate) <= paymentService.parseLocalDate(startDate)) {
        return Alert.alert('Invalid Dates', 'Stop date must be after start date.');
      }
    }
    if (frequency === 'custom' && (!customDays || Number(customDays) <= 0))
      return Alert.alert('Custom Interval', 'Enter how many days between each payment.');

    try {
      setSubmitting(true);

      const [y, mon, d] = startDate.split('-').map(Number);
      const [h, m] = (form.startTime || '09:00').split(':').map(Number);
      const nextDateObj = new Date(y, mon - 1, d, h, m, 0);
      const fullNextDate = nextDateObj.toISOString();
      
      const payload = {
        user_id:     userId,
        title:       title.trim(),
        amount:      parseFloat(amount),
        type,
        frequency,
        start_date:  startDate,
        end_date:    endDate,
        next_date:   fullNextDate,
        category_id: selectedCategory?.id || null,
      };

      if (editingPayment) {
        await paymentService.updatePlannedPayment(editingPayment.id, {
          title:       payload.title,
          amount:      payload.amount,
          type:        payload.type,
          frequency:   paymentService.normalizeFrequency(frequency, customDays),
          start_date:  payload.start_date,
          end_date:    payload.end_date,
          next_date:   payload.next_date,
          category_id: payload.category_id,
        });
      } else {
        await paymentService.addPlannedPayment(payload);
      }

      setShowAddModal(false);
      resetForm();
      fetchPlannedPayments();
    } catch (error) {
      Alert.alert('Error', `Could not save payment. ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Open edit modal ────────────────────────────────────────────── */
  const openEditModal = async (item) => {
    let frequency = item.frequency || 'monthly';
    let customDays = '3';
    if (frequency.startsWith('custom:')) {
      customDays = frequency.split(':')[1] || '3';
      frequency = 'custom';
    }

    // Default start/end if columns didn't exist before
    const today = paymentService.formatLocalDate(new Date());
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    setEditingPayment(item);
    // Restore time from next_date if available
    const existingDate = item.next_date ? paymentService.parseLocalDate(item.next_date) : null;
    const existingTime = existingDate
      ? `${String(existingDate.getHours()).padStart(2,'0')}:${String(existingDate.getMinutes()).padStart(2,'0')}`
      : '09:00';

    setForm({
      title:      item.title || '',
      amount:     String(item.amount || ''),
      type:       item.type || 'expense',
      frequency,
      customDays,
      startDate:  item.start_date || item.next_date || today,
      startTime:  existingTime,
      endDate:    item.end_date   || paymentService.formatLocalDate(nextYear),
    });

    let cats = categories;
    if (cats.length === 0) {
      try {
        const data = await transactionService.getCategories(userId);
        cats = data || [];
        setCategories(cats);
      } catch {}
    }
    const foundCat = item.category_id ? cats.find(c => c.id === item.category_id) || null : null;
    setSelectedCategory(foundCat);
    // Pre-open the parent if a sub-category is already selected
    if (foundCat?.parent_id) {
      setActiveParent(cats.find(c => c.id === foundCat.parent_id) || null);
    } else {
      setActiveParent(null);
    }
    setShowAddModal(true);
  };

  /* ── Record now / Delete ────────────────────────────────────────── */
  const handleRecordNow = async (item) => {
    try {
      setRecordingId(item.id);
      await paymentService.recordPlannedPaymentNow(item);
      await fetchPlannedPayments();
      Alert.alert('Payment Recorded', 'Added to your ledger and next due date advanced.');
    } catch (error) {
      Alert.alert('Error', `Could not record payment. ${error.message}`);
    } finally {
      setRecordingId(null);
    }
  };

  const deletePlanned = async (id) => {
    Alert.alert(
      'Delete Planned Payment',
      'Are you sure you want to stop this planned payment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await paymentService.deletePlannedPayment(id);
              fetchPlannedPayments();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  /* ── Frequency helpers ──────────────────────────────────────────── */
  const frequencyOptions = [
    { value: 'daily',   label: 'Daily'   },
    { value: 'weekly',  label: 'Weekly'  },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly',  label: 'Yearly'  },
    { value: 'custom',  label: 'Custom'  },
  ];

  const frequencyPreview = form.frequency === 'custom'
    ? paymentService.getFrequencyLabel(paymentService.normalizeFrequency('custom', form.customDays))
    : paymentService.getFrequencyLabel(form.frequency);

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={openDrawer} style={styles.backButton}>
          <Menu color={COLORS.text} size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Planned Payments</Text>
        <Pressable onPress={() => setShowAddModal(true)} style={styles.addButton}>
          <Plus color={COLORS.primary} size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.infoCard, { backgroundColor: COLORS.surface, borderRadius: 14 }]}>
          <Clock color={COLORS.primary} size={18} />
          <Text style={styles.infoText}>
            Recurring bills, subscriptions, and salaries. Due payments auto-record into the ledger.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
        ) : !tableExists ? (
          <View style={[styles.emptyState, { padding: 32 }]}>
            <Clock color={COLORS.error} size={48} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyTitle, { color: COLORS.error }]}>Table Not Found</Text>
            <Text style={styles.emptySub}>Run the Supabase migration to create the planned_payments table.</Text>
            <AppButton title="Check Again" onPress={fetchPlannedPayments} style={{ backgroundColor: COLORS.error, marginTop: 16 }} />
          </View>
        ) : plannedPayments.length > 0 ? (
          plannedPayments.map((item) => (
            <PaymentCard
              key={item.id}
              item={item}
              onDelete={recordingId ? undefined : deletePlanned}
              onRecord={handleRecordNow}
              recording={recordingId === item.id}
              onEdit={recordingId ? undefined : openEditModal}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <CalendarClock color={COLORS.textSecondary} size={56} style={{ opacity: 0.4, marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>No Planned Payments</Text>
            <Text style={styles.emptySub}>Add your first repeating bill or salary.</Text>
            <AppButton title="Add Planned Payment" onPress={() => setShowAddModal(true)} style={{ marginTop: 16 }} />
          </View>
        )}
      </ScrollView>

      {/* ── Add / Edit Modal ───────────────────────────────────────── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowAddModal(false); resetForm(); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' }}
        >
          <View style={{ backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '94%' }}>
            {/* Handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: 10 }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.divider }}>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '800' }}>
                {editingPayment ? 'Edit Payment' : 'New Planned Payment'}
              </Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }} style={{ padding: 4 }}>
                <X color={COLORS.text} size={22} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              {/* Title */}
              <AppInput
                label="Title *"
                placeholder="e.g. House Rent, Netflix, Salary"
                value={form.title}
                onChangeText={(v) => updateFormField('title', v)}
              />

              {/* Amount */}
              <AppInput
                label={`Amount (${currency}) *`}
                keyboardType="decimal-pad"
                placeholder="0.00"
                value={form.amount}
                onChangeText={(v) => updateFormField('amount', v)}
              />

              {/* Type */}
              <Text style={[styles.label, { marginBottom: 10 }]}>Type *</Text>
              <View style={[styles.row, { marginBottom: 20 }]}>
                {['expense', 'income'].map(t => (
                  <Pressable
                    key={t}
                    onPress={() => updateFormField('type', t)}
                    style={[
                      styles.chip,
                      form.type === t && [styles.activeChip, { backgroundColor: t === 'expense' ? COLORS.error + '22' : COLORS.success + '22', borderColor: t === 'expense' ? COLORS.error : COLORS.success }]
                    ]}
                  >
                    <Text style={[
                      styles.chipText,
                      form.type === t && { color: t === 'expense' ? COLORS.error : COLORS.success, fontWeight: '700' }
                    ]}>
                      {t === 'expense' ? '↑ Expense' : '↓ Income'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Start Date & End Date in a row */}
              <Text style={[styles.label, { marginBottom: 10 }]}>Period *</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <TouchableOpacity
                  style={[styles.calendarTrigger, { flex: 1, flexDirection: 'column', alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border }]}
                  onPress={() => openDatePicker('start')}
                >
                  <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>START DATE</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <CalendarIcon color={COLORS.primary} size={15} />
                    <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '600' }}>{fmtDate(form.startDate)}</Text>
                  </View>
                </TouchableOpacity>

                <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.calendarTrigger, { flex: 1, flexDirection: 'column', alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border }]}
                    onPress={() => openDatePicker('end')}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' }}>STOP DATE</Text>
                      {form.endDate && (
                        <Pressable onPress={() => updateFormField('endDate', null)} hitSlop={10}>
                          <Text style={{ color: COLORS.primary, fontSize: 10, fontWeight: '700' }}>SET FOREVER</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <CalendarIcon color={form.endDate ? COLORS.error : COLORS.success} size={15} />
                      <Text style={{ color: form.endDate ? COLORS.text : COLORS.success, fontSize: 14, fontWeight: '600' }}>
                        {form.endDate ? fmtDate(form.endDate) : 'Lifetime / Forever'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Time picker for start time */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border }}
                onPress={() => openDatePicker('time')}
              >
                <Icons.Clock color={COLORS.primary} size={16} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 2 }}>PAYMENT TIME</Text>
                  <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '600' }}>{form.startTime || '09:00'}</Text>
                </View>
                <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>Tap to change</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={(() => {
                    if (datePickerField === 'time') {
                      const d = new Date();
                      const [h, m] = (form.startTime || '09:00').split(':');
                      d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
                      return d;
                    }
                    const baseDate = datePickerField === 'start'
                      ? (paymentService.parseLocalDate(form.startDate) || new Date())
                      : (paymentService.parseLocalDate(form.endDate)   || new Date());
                    baseDate.setHours(12, 0, 0, 0); // Use noon to avoid TZ shifts
                    return baseDate;
                  })()}
                  mode={datePickerField === 'time' ? 'time' : 'date'}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  is24Hour={false}
                  textColor={COLORS.text}
                  minimumDate={datePickerField === 'end' ? paymentService.parseLocalDate(form.startDate) || new Date() : undefined}
                  onChange={onDateChange}
                />
              )}

              {/* Repeat */}
              <View style={[styles.sectionBlock, { marginBottom: 16 }]}>
                <View style={[styles.sectionHeaderRow, { marginBottom: 10 }]}>
                  <Repeat color={COLORS.primary} size={15} />
                  <Text style={styles.label}>Repeat *</Text>
                </View>
                <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
                  {frequencyOptions.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => updateFormField('frequency', opt.value)}
                      style={[
                        styles.smallChip,
                        form.frequency === opt.value && [styles.activeChip, { backgroundColor: COLORS.primary + '22', borderColor: COLORS.primary }]
                      ]}
                    >
                      <Text style={[
                        styles.smallChipText,
                        form.frequency === opt.value && [styles.activeChipText, { color: COLORS.primary }]
                      ]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {form.frequency === 'custom' && (
                  <AppInput
                    label="Repeat Every (Days)"
                    keyboardType="number-pad"
                    placeholder="e.g. 14"
                    value={form.customDays}
                    onChangeText={(v) => updateFormField('customDays', v.replace(/[^0-9]/g, ''))}
                    containerStyle={{ marginTop: 12, marginBottom: 0 }}
                  />
                )}
                <Text style={[styles.helperText, { marginTop: 8 }]}>Schedule: {frequencyPreview}</Text>
              </View>

              {/* Category (Optional) — hierarchical picker */}
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={styles.label}>
                    {activeParent ? `Category: ${activeParent.name}` : 'Category (optional)'}
                  </Text>
                  {activeParent && (
                    <Pressable onPress={() => { setActiveParent(null); setSelectedCategory(null); }}>
                      <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>Change Group</Text>
                    </Pressable>
                  )}
                </View>

                {fetchingCategories ? (
                  <ActivityIndicator color={COLORS.primary} size="small" />
                ) : !activeParent ? (
                  /* STEP 1: Parent category grid */
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {categories
                      .filter(c => !c.parent_id && (c.type === form.type || c.type === 'both'))
                      .map(parent => {
                        const IC = Icons[parent.icon] || Icons.Circle;
                        return (
                          <Pressable
                            key={parent.id}
                            style={{
                              width: '30%',
                              backgroundColor: COLORS.card,
                              borderRadius: 14,
                              padding: 12,
                              alignItems: 'center',
                              borderWidth: 1.5,
                              borderBottomWidth: 3,
                              borderColor: COLORS.border,
                              borderBottomColor: parent.color || COLORS.primary,
                            }}
                            onPress={() => setActiveParent(parent)}
                          >
                            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: (parent.color || COLORS.primary) + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                              <IC size={20} color={parent.color || COLORS.primary} />
                            </View>
                            <Text style={{ color: COLORS.text, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>{parent.name}</Text>
                          </Pressable>
                        );
                      })
                    }
                  </View>
                ) : (
                  /* STEP 2: Sub-category chips */
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {categories
                      .filter(c => c.parent_id === activeParent.id)
                      .map(sub => {
                        const isSelected = selectedCategory?.id === sub.id;
                        return (
                          <Pressable
                            key={sub.id}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 20,
                              borderWidth: 1.5,
                              borderColor: isSelected ? (activeParent.color || COLORS.primary) : COLORS.border,
                              backgroundColor: isSelected ? (activeParent.color || COLORS.primary) + '22' : COLORS.inputBg,
                            }}
                            onPress={() => setSelectedCategory(isSelected ? null : sub)}
                          >
                            <Text style={{
                              color: isSelected ? (activeParent.color || COLORS.primary) : COLORS.textSecondary,
                              fontWeight: isSelected ? '700' : '500',
                              fontSize: 13,
                            }}>
                              {sub.name}
                            </Text>
                          </Pressable>
                        );
                      })
                    }
                    {categories.filter(c => c.parent_id === activeParent.id).length === 0 && (
                      <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>No sub-categories found.</Text>
                    )}
                  </View>
                )}

                {/* Show selected category badge */}
                {selectedCategory && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: activeParent?.color || COLORS.primary }} />
                    <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                      Selected: <Text style={{ color: COLORS.text, fontWeight: '700' }}>{selectedCategory.name}</Text>
                    </Text>
                    <Pressable onPress={() => { setSelectedCategory(null); }}>
                      <X color={COLORS.textSecondary} size={14} />
                    </Pressable>
                  </View>
                )}
              </View>

              <AppButton
                title={editingPayment ? 'Update Payment' : 'Save Planned Payment'}
                onPress={handleSavePayment}
                loading={submitting}
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default PlannedPayments;
