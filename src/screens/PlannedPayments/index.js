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
  Info,
  Archive,
  Bell,
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
import { accountService } from '../../services/accountService';
import { makeStyles } from './styles';
import * as Icons from 'lucide-react-native';
import HeaderPlusButton from '../../components/HeaderPlusButton';
import HeaderMenu from '../../components/HeaderMenu';

const CASH_ACCOUNT = {
  id: '__cash__',
  account_name: 'Cash',
  bank_name: 'No balance tracking',
  icon: 'Banknote',
  color: '#22c55e',
  balance: null,
};

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
  const [archivedPayments, setArchivedPayments]  = useState([]);
  const [activeTab,        setActiveTab]         = useState(0);
  const [showAddModal,     setShowAddModal]      = useState(false);
  const [recordingId,      setRecordingId]       = useState(null);
  const [editingPayment,   setEditingPayment]    = useState(null);
  const [categories,        setCategories]        = useState([]);
  const [selectedCategory,  setSelectedCategory]  = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryModalParent, setCategoryModalParent] = useState(null);
  const [accounts,          setAccounts]          = useState([]);
  const [selectedAccount,   setSelectedAccount]   = useState(CASH_ACCOUNT);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [fetchingCategories, setFetchingCategories] = useState(false);
  const [tableExists,       setTableExists]       = useState(true);
  const [form,              setForm]              = useState(buildDefaultForm());

  // Date/time picker state
  const [datePickerField,  setDatePickerField]   = useState(null); // 'start' | 'end' | 'time'
  const [showDatePicker,   setShowDatePicker]    = useState(false);

  /* ── Fetch ─────────────────────────────────────────────────────── */
  const fetchPlannedPayments = async () => {
    try {
      setLoading(true);
      setTableExists(true);
      if (!userId) return;
      const [active, archived] = await Promise.all([
        paymentService.getPlannedPayments(userId),
        paymentService.getArchivedPlannedPayments(userId),
      ]);
      setPlannedPayments(active);
      setArchivedPayments(archived);
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
      const [data, accts] = await Promise.all([
        transactionService.getCategories(userId),
        accountService.getAccounts(userId).catch(() => []),
      ]);
      if (data?.length > 0) setCategories(data);
      setAccounts(accts || []);
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
    setCategoryModalParent(null);
    setSelectedAccount(CASH_ACCOUNT);
    setEditingPayment(null);
  };

  const updateFormField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'type') {
      setSelectedCategory(null);
      setCategoryModalParent(null);
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
      
      const resolvedAccountId = selectedAccount?.id === '__cash__' ? null : selectedAccount?.id ?? null;
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
        account_id:  resolvedAccountId,
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
          account_id:  payload.account_id,
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
    setCategoryModalParent(null);

    // Pre-select account
    let accts = accounts;
    if (accts.length === 0) {
      try { accts = await accountService.getAccounts(userId).catch(() => []); setAccounts(accts); } catch {}
    }
    const foundAccount = item.account_id ? accts.find(a => a.id === item.account_id) ?? CASH_ACCOUNT : CASH_ACCOUNT;
    setSelectedAccount(foundAccount);

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
  const showPageInfo = () => Alert.alert('About This Page', 'Schedule recurring payments like rent or subscriptions. The app reminds you before due dates.');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={openDrawer} style={styles.backButton}>
          <Menu color={COLORS.text} size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Planned Payments</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <HeaderPlusButton onPress={() => setShowAddModal(true)} />
          <HeaderMenu items={[
            { icon: Info, label: 'About This Page', onPress: showPageInfo },
          ]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.infoCard, { backgroundColor: COLORS.surface, borderRadius: 14 }]}>
          <Clock color={COLORS.primary} size={18} />
          <Text style={styles.infoText}>
            Recurring bills, subscriptions, and salaries. Due payments auto-record into the ledger.
          </Text>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, activeTab === 0 && styles.tabActive]}
            onPress={() => setActiveTab(0)}
          >
            <Bell color={activeTab === 0 ? COLORS.primary : COLORS.textSecondary} size={16} />
            <Text style={[styles.tabText, activeTab === 0 && styles.tabTextActive]}>Active</Text>
            {plannedPayments.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: COLORS.primary }]}>
                <Text style={styles.tabBadgeText}>{plannedPayments.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 1 && styles.tabActive]}
            onPress={() => setActiveTab(1)}
          >
            <Archive color={activeTab === 1 ? COLORS.primary : COLORS.textSecondary} size={16} />
            <Text style={[styles.tabText, activeTab === 1 && styles.tabTextActive]}>Archive</Text>
            {archivedPayments.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: COLORS.textSecondary }]}>
                <Text style={styles.tabBadgeText}>{archivedPayments.length}</Text>
              </View>
            )}
          </Pressable>
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
        ) : activeTab === 0 ? (
          plannedPayments.length > 0 ? (
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
              <Text style={styles.emptyTitle}>No Active Payments</Text>
              <Text style={styles.emptySub}>Add your first repeating bill or salary.</Text>
              <AppButton title="Add Planned Payment" onPress={() => setShowAddModal(true)} style={{ marginTop: 16 }} />
            </View>
          )
        ) : (
          archivedPayments.length > 0 ? (
            archivedPayments.map((item) => (
              <PaymentCard
                key={item.id}
                item={item}
                onDelete={recordingId ? undefined : deletePlanned}
                recording={recordingId === item.id}
                archived
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Archive color={COLORS.textSecondary} size={56} style={{ opacity: 0.4, marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>Archive is Empty</Text>
              <Text style={styles.emptySub}>Payments that reach their end date will appear here.</Text>
            </View>
          )
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

              {/* Category (Optional) — compact pressable */}
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.label, { marginBottom: 8 }]}>Category (optional)</Text>
                {fetchingCategories ? (
                  <ActivityIndicator color={COLORS.primary} size="small" style={{ alignSelf: 'flex-start' }} />
                ) : (
                  <Pressable
                    onPress={() => { setCategoryModalParent(null); setShowCategoryModal(true); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 12,
                      borderWidth: 1.5, borderColor: selectedCategory ? selectedCategory.color + '90' : COLORS.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    {selectedCategory ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: selectedCategory.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                          {(() => { const IC = Icons[selectedCategory.icon] || Icons.Circle; return <IC size={16} color={selectedCategory.color} />; })()}
                        </View>
                        <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>{selectedCategory.name}</Text>
                        <Pressable onPress={() => setSelectedCategory(null)} hitSlop={10}>
                          <Icons.X color={COLORS.textSecondary} size={14} />
                        </Pressable>
                      </View>
                    ) : (
                      <Text style={{ color: COLORS.textSecondary, fontSize: 14, flex: 1 }}>Tap to select (optional)</Text>
                    )}
                    {!selectedCategory && <Icons.ChevronRight color={COLORS.textSecondary} size={16} />}
                  </Pressable>
                )}
              </View>

              {/* Payment Source */}
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={styles.label}>Payment Source</Text>
                  {selectedAccount && selectedAccount.id !== '__cash__' && selectedAccount.balance != null && (
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' }}>
                      Bal: {Number(selectedAccount.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => setShowAccountPicker(true)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 12,
                    borderWidth: 1.5, borderColor: selectedAccount ? selectedAccount.color + '90' : COLORS.border,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: selectedAccount.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                      {(() => { const IC = Icons[selectedAccount.icon] || Icons.Wallet; return <IC size={16} color={selectedAccount.color} />; })()}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{selectedAccount.account_name}</Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 11 }} numberOfLines={1}>{selectedAccount.bank_name}</Text>
                    </View>
                  </View>
                  <Icons.ChevronDown color={COLORS.textSecondary} size={16} />
                </Pressable>
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
      {/* Account Picker Modal */}
      <Modal visible={showAccountPicker} transparent animationType="slide" onRequestClose={() => setShowAccountPicker(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setShowAccountPicker(false)}>
          <Pressable style={{ backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28 }} onPress={() => {}}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider }}>
              <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '800' }}>Select Payment Source</Text>
              <Pressable onPress={() => setShowAccountPicker(false)} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.surface || COLORS.inputBg, alignItems: 'center', justifyContent: 'center' }}>
                <Icons.X color={COLORS.textSecondary} size={16} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
              {[CASH_ACCOUNT, ...accounts].map(acct => {
                const isSelected = selectedAccount?.id === acct.id;
                const IC = Icons[acct.icon] || Icons.Wallet;
                const isCash = acct.id === '__cash__';
                return (
                  <Pressable
                    key={acct.id}
                    onPress={() => { setSelectedAccount(acct); setShowAccountPicker(false); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      padding: 14, borderRadius: 16, marginBottom: 4,
                      backgroundColor: isSelected ? acct.color + '18' : COLORS.inputBg,
                      borderWidth: 1.5, borderColor: isSelected ? acct.color : COLORS.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: acct.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <IC size={20} color={acct.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 15 }}>{acct.account_name}</Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>{acct.bank_name}</Text>
                    </View>
                    {!isCash && (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: acct.color, fontWeight: '800', fontSize: 14 }}>
                          {Number(acct.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </Text>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>Balance</Text>
                      </View>
                    )}
                    {isSelected && <Icons.CheckCircle color={acct.color} size={20} />}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ height: 24 }} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => setShowCategoryModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setShowCategoryModal(false)}>
          <Pressable style={{ backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }} onPress={() => {}}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider }}>
              <View>
                <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '800' }}>
                  {categoryModalParent ? categoryModalParent.name : 'Select Category'}
                </Text>
                {categoryModalParent && (
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>Choose a sub-category</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {categoryModalParent && (
                  <Pressable onPress={() => setCategoryModalParent(null)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border }}>
                    <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600' }}>← Groups</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setShowCategoryModal(false)} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.inputBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.X color={COLORS.textSecondary} size={16} />
                </Pressable>
              </View>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {!categoryModalParent ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {categories.filter(c => !c.parent_id && (c.type === form.type || c.type === 'both')).map(parent => {
                    const IC = Icons[parent.icon] || Icons.Circle;
                    return (
                      <Pressable
                        key={parent.id}
                        style={{ width: '30%', backgroundColor: COLORS.inputBg, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1.5, borderBottomWidth: 3, borderColor: COLORS.border, borderBottomColor: parent.color || COLORS.primary }}
                        onPress={() => setCategoryModalParent(parent)}
                      >
                        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: (parent.color || COLORS.primary) + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                          <IC size={20} color={parent.color || COLORS.primary} />
                        </View>
                        <Text style={{ color: COLORS.text, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>{parent.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {categories.filter(c => c.parent_id === categoryModalParent.id).map(sub => {
                    const isSelected = selectedCategory?.id === sub.id;
                    return (
                      <Pressable
                        key={sub.id}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: isSelected ? (categoryModalParent.color || COLORS.primary) : COLORS.border, backgroundColor: isSelected ? (categoryModalParent.color || COLORS.primary) + '22' : COLORS.inputBg }}
                        onPress={() => { setSelectedCategory(isSelected ? null : sub); setShowCategoryModal(false); setCategoryModalParent(null); }}
                      >
                        <Text style={{ color: isSelected ? (categoryModalParent.color || COLORS.primary) : COLORS.textSecondary, fontWeight: isSelected ? '700' : '500', fontSize: 13 }}>
                          {sub.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>
            <View style={{ height: 24 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default PlannedPayments;
