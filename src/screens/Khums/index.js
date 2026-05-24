import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Modal, Platform,
  KeyboardAvoidingView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Menu, Plus, X, Info, RefreshCw, Pencil, Trash2,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Calendar, Landmark, DollarSign, ShoppingCart, Home,
  Car, Heart, GraduationCap, Plane, Sparkles, Gift,
  Briefcase, MoreHorizontal, Baby, CheckCircle, Shirt,
} from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDrawer }  from '../../context/DrawerContext';
import { useAuth }    from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useTheme }   from '../../context/ThemeContext';
import { makeStyles } from './styles';
import { khumsService } from '../../services/khumsService';

/* ─── constants ──────────────────────────────────────────────────── */

const KHUMS_PURPLE = '#7c3aed';

const EXPENSE_CATEGORIES = [
  { key: 'food',       label: 'Food & Groceries',    Icon: ShoppingCart },
  { key: 'housing',    label: 'Rent & Housing',       Icon: Home },
  { key: 'clothing',   label: 'Clothing & Personal',  Icon: Shirt },
  { key: 'transport',  label: 'Transport',             Icon: Car },
  { key: 'children',   label: "Children's Expenses",  Icon: Baby },
  { key: 'healthcare', label: 'Healthcare',            Icon: Heart },
  { key: 'education',  label: 'Education',             Icon: GraduationCap },
  { key: 'ziyarah',    label: 'Ziyarah & Hajj',       Icon: Plane },
  { key: 'wedding',    label: 'Wedding & Events',      Icon: Sparkles },
  { key: 'gifts',      label: 'Gifts & Charity',       Icon: Gift },
  { key: 'business',   label: 'Business Costs',        Icon: Briefcase },
  { key: 'other',      label: 'Other',                 Icon: MoreHorizontal },
];

const EXEMPT_LABELS = [
  'Mahr (Dowry)',
  'Inheritance',
  'Blood Money (Diyah)',
  'Previously Khums-Paid Savings',
  'Household Items (Used in Year)',
  "Women's Jewelry",
  'Other Exempt',
];

const fmt = (n, cur) =>
  `${cur} ${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const catIcon = (key) => {
  const found = EXPENSE_CATEGORIES.find(c => c.key === key);
  return found ? found.Icon : MoreHorizontal;
};

const catLabel = (key) => {
  const found = EXPENSE_CATEGORIES.find(c => c.key === key);
  return found ? found.label : key;
};

/* ─── Status badge ───────────────────────────────────────────────── */
const StatusBadge = ({ status, styles }) => {
  const cfg = {
    open:     { bg: 'rgba(255,255,255,0.15)', text: '#fff',    label: 'Open' },
    partial:  { bg: 'rgba(251,191,36,0.3)',   text: '#fbbf24', label: 'Partial' },
    settled:  { bg: 'rgba(34,197,94,0.3)',    text: '#22c55e', label: 'Settled ✓' },
  }[status] || { bg: 'rgba(255,255,255,0.15)', text: '#fff', label: status };

  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.statusBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN SCREEN
═══════════════════════════════════════════════════════════════════ */

const Khums = () => {
  const { openDrawer }     = useDrawer();
  const { userId }         = useAuth();
  const { currency }       = useProfile();
  const { colors: COLORS } = useTheme();
  const styles             = useMemo(() => makeStyles(COLORS), [COLORS]);

  /* ── Data ───────────────────────────────────────────────────────── */
  const [years,      setYears]      = useState([]);
  const [yearIdx,    setYearIdx]    = useState(0);
  const [expenses,   setExpenses]   = useState([]);
  const [payments,   setPayments]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPayHistory, setShowPayHistory] = useState(false);
  const [expFilter,  setExpFilter]  = useState('all');
  const [notesVal,   setNotesVal]   = useState('');
  const [saveNotesTm, setSaveNotesTm] = useState(null);

  const currentYear = years[yearIdx] ?? null;

  /* ── Modals ─────────────────────────────────────────────────────── */
  const [showNewYear,  setShowNewYear]  = useState(false);
  const [showExpense,  setShowExpense]  = useState(false);
  const [showPayment,  setShowPayment]  = useState(false);
  const [showIncome,   setShowIncome]   = useState(false);

  // New-year form
  const [newYearDate,    setNewYearDate]    = useState(new Date());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [savingYear,     setSavingYear]     = useState(false);

  // Expense form
  const [expCat,    setExpCat]    = useState('food');
  const [expAmount, setExpAmount] = useState('');
  const [expDesc,   setExpDesc]   = useState('');
  const [savingExp, setSavingExp] = useState(false);

  // Payment form
  const [payType,      setPayType]      = useState('sahm_imam');
  const [payRecipient, setPayRecipient] = useState('');
  const [payAmount,    setPayAmount]    = useState('');
  const [payDate,      setPayDate]      = useState(new Date());
  const [payNotes,     setPayNotes]     = useState('');
  const [showPayDate,  setShowPayDate]  = useState(false);
  const [savingPay,    setSavingPay]    = useState(false);

  // Income edit form
  const [extraIncome,   setExtraIncome]   = useState('');
  const [exemptIncome,  setExemptIncome]  = useState('');
  const [savingIncome,  setSavingIncome]  = useState(false);

  /* ── Fetch ──────────────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const ys = await khumsService.getYears(userId);
      setYears(ys);
      if (ys.length > 0) {
        const yr = ys[yearIdx] ?? ys[0];
        const [exps, pays] = await Promise.all([
          khumsService.getExpenses(yr.id),
          khumsService.getPayments(yr.id),
        ]);
        setExpenses(exps);
        setPayments(pays);
        setNotesVal(yr.notes ?? '');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [userId, yearIdx]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const fetchYearData = async (yr) => {
    if (!yr) return;
    const [exps, pays] = await Promise.all([
      khumsService.getExpenses(yr.id),
      khumsService.getPayments(yr.id),
    ]);
    setExpenses(exps);
    setPayments(pays);
    setNotesVal(yr.notes ?? '');
  };

  const switchYear = async (newIdx) => {
    setYearIdx(newIdx);
    setExpFilter('all');
    setShowPayHistory(false);
    const yr = years[newIdx];
    if (yr) {
      const freshYears = await khumsService.getYears(userId);
      setYears(freshYears);
      await fetchYearData(freshYears[newIdx] ?? yr);
    }
  };

  /* ── Auto income refresh ─────────────────────────────────────────── */
  const handleRefreshIncome = async () => {
    if (!currentYear) return;
    setRefreshing(true);
    try {
      const total = await khumsService.refreshAutoIncome(currentYear.id);
      const freshYears = await khumsService.getYears(userId);
      setYears(freshYears);
      Alert.alert('Updated', `Auto income set to ${fmt(total, currency)} from your transactions.`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setRefreshing(false);
    }
  };

  /* ── New year ────────────────────────────────────────────────────── */
  const handleCreateYear = async () => {
    setSavingYear(true);
    try {
      await khumsService.createYear(userId, newYearDate.toISOString());
      setShowNewYear(false);
      const freshYears = await khumsService.getYears(userId);
      setYears(freshYears);
      setYearIdx(0);
      await fetchYearData(freshYears[0]);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingYear(false);
    }
  };

  /* ── Add expense ─────────────────────────────────────────────────── */
  const handleAddExpense = async () => {
    if (!expAmount || !currentYear) return;
    setSavingExp(true);
    try {
      await khumsService.addExpense(userId, currentYear.id, {
        category: expCat, amount: expAmount, description: expDesc,
      });
      setShowExpense(false);
      setExpAmount(''); setExpDesc('');
      const freshYears = await khumsService.getYears(userId);
      setYears(freshYears);
      const exps = await khumsService.getExpenses(currentYear.id);
      setExpenses(exps);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingExp(false);
    }
  };

  const handleDeleteExpense = (exp) => {
    Alert.alert('Delete Expense', `Remove ${catLabel(exp.category)} ${fmt(exp.amount, currency)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await khumsService.deleteExpense(exp.id, currentYear.id);
          const [freshYears, exps] = await Promise.all([
            khumsService.getYears(userId),
            khumsService.getExpenses(currentYear.id),
          ]);
          setYears(freshYears);
          setExpenses(exps);
        },
      },
    ]);
  };

  /* ── Save income edits ───────────────────────────────────────────── */
  const handleSaveIncome = async () => {
    if (!currentYear) return;
    setSavingIncome(true);
    try {
      await khumsService.updateYear(currentYear.id, {
        income_extra:  parseFloat(extraIncome)  || 0,
        income_exempt: parseFloat(exemptIncome) || 0,
      });
      setShowIncome(false);
      const freshYears = await khumsService.getYears(userId);
      setYears(freshYears);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingIncome(false);
    }
  };

  /* ── Add payment ─────────────────────────────────────────────────── */
  const handleAddPayment = async () => {
    if (!payAmount || !currentYear) return;
    setSavingPay(true);
    try {
      await khumsService.addPayment(userId, currentYear.id, {
        recipient_type: payType,
        recipient_name: payRecipient,
        amount: payAmount,
        date: payDate.toISOString(),
        notes: payNotes,
      });
      setShowPayment(false);
      setPayAmount(''); setPayRecipient(''); setPayNotes('');
      const [freshYears, pays] = await Promise.all([
        khumsService.getYears(userId),
        khumsService.getPayments(currentYear.id),
      ]);
      setYears(freshYears);
      setPayments(pays);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingPay(false);
    }
  };

  const handleDeletePayment = (pay) => {
    Alert.alert('Delete Payment', `Remove payment of ${fmt(pay.amount, currency)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await khumsService.deletePayment(pay.id, currentYear.id);
          const [freshYears, pays] = await Promise.all([
            khumsService.getYears(userId),
            khumsService.getPayments(currentYear.id),
          ]);
          setYears(freshYears);
          setPayments(pays);
        },
      },
    ]);
  };

  /* ── Notes auto-save ─────────────────────────────────────────────── */
  const handleNotesChange = (text) => {
    setNotesVal(text);
    if (saveNotesTm) clearTimeout(saveNotesTm);
    const tm = setTimeout(async () => {
      if (currentYear) {
        await khumsService.updateYear(currentYear.id, { notes: text });
      }
    }, 1000);
    setSaveNotesTm(tm);
  };

  /* ── Delete year ─────────────────────────────────────────────────── */
  const handleDeleteYear = () => {
    if (!currentYear) return;
    Alert.alert(
      'Delete Khums Year',
      `Delete ${currentYear.year_label}? All expenses and payments will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await khumsService.deleteYear(currentYear.id);
            const freshYears = await khumsService.getYears(userId);
            setYears(freshYears);
            const newIdx = Math.max(0, yearIdx - 1);
            setYearIdx(newIdx);
            if (freshYears.length > 0) await fetchYearData(freshYears[newIdx]);
            else { setExpenses([]); setPayments([]); }
          },
        },
      ]
    );
  };

  /* ── Info alert ──────────────────────────────────────────────────── */
  const showInfo = () => Alert.alert(
    'About Khums',
    'Khums is 20% of your annual net surplus (income minus permitted living expenses), obligatory for Shia Muslims.\n\n' +
    '• Sahm-e-Imam (10%): Given to the Marjaʿ or their authorised representative.\n' +
    '• Sahm-e-Sadat (10%): Given to deserving Sayyids (poor, orphan, or stranded).\n\n' +
    'Exempt: Mahr, valid inheritance, blood money (Diyah), previously Khums-paid savings.\n\n' +
    'Based on rulings of Ayatollah Sistani (Minhaj al-Salihin).',
    [{ text: 'OK' }]
  );

  /* ── Filtered expenses ───────────────────────────────────────────── */
  const filteredExpenses = useMemo(() =>
    expFilter === 'all' ? expenses : expenses.filter(e => e.category === expFilter),
    [expenses, expFilter]
  );

  /* ── Progress % helpers ──────────────────────────────────────────── */
  const imamPct  = currentYear ? Math.min(100, currentYear.sahm_imam  > 0 ? (currentYear.paid_imam  / currentYear.sahm_imam)  * 100 : 0) : 0;
  const sadatPct = currentYear ? Math.min(100, currentYear.sahm_sadat > 0 ? (currentYear.paid_sadat / currentYear.sahm_sadat) * 100 : 0) : 0;

  /* ── Gross taxable ───────────────────────────────────────────────── */
  const grossTaxable = currentYear
    ? Math.max(0, (currentYear.income_auto + currentYear.income_extra) - currentYear.income_exempt)
    : 0;

  /* ───────────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={KHUMS_PURPLE} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={openDrawer}>
          <Menu color={COLORS.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Khums Calculator</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={showInfo}>
          <Info color={KHUMS_PURPLE} size={20} />
        </TouchableOpacity>
        {currentYear && (
          <TouchableOpacity style={styles.headerBtn} onPress={handleDeleteYear}>
            <Trash2 color={COLORS.error} size={18} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── No years empty state ── */}
        {years.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Landmark color={KHUMS_PURPLE} size={36} />
            </View>
            <Text style={styles.emptyTitle}>No Khums Year Yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first Khums year to begin tracking your annual obligation. Set your Khums anniversary date to get started.
            </Text>
            <TouchableOpacity style={styles.emptyCreateBtn} onPress={() => setShowNewYear(true)}>
              <Plus color="#fff" size={18} />
              <Text style={styles.emptyCreateBtnText}>Create Khums Year</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Year Selector ── */}
            <View style={styles.yearRow}>
              <TouchableOpacity
                style={[styles.yearNavBtn, yearIdx >= years.length - 1 && { opacity: 0.3 }]}
                onPress={() => yearIdx < years.length - 1 && switchYear(yearIdx + 1)}
                disabled={yearIdx >= years.length - 1}
              >
                <ChevronLeft color={COLORS.text} size={20} />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.yearLabel}>{currentYear?.year_label ?? '—'}</Text>
                {currentYear && (
                  <Text style={styles.yearLabelSub}>
                    {fmtDate(currentYear.year_start)} – {fmtDate(currentYear.year_end)}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.yearNavBtn, yearIdx <= 0 && { opacity: 0.3 }]}
                onPress={() => yearIdx > 0 && switchYear(yearIdx - 1)}
                disabled={yearIdx <= 0}
              >
                <ChevronRight color={COLORS.text} size={20} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.newYearBtn} onPress={() => setShowNewYear(true)}>
                <Plus color={KHUMS_PURPLE} size={14} />
                <Text style={styles.newYearBtnText}>New Year</Text>
              </TouchableOpacity>
            </View>

            {/* ── Summary Card ── */}
            {currentYear && (
              <LinearGradient
                colors={['#7c3aed', '#4f46e5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.summaryCard}
              >
                <View style={styles.summaryTopRow}>
                  <View>
                    <Text style={styles.summaryKhumsLabel}>Khums Due</Text>
                    <Text style={styles.summaryKhumsAmount}>{fmt(currentYear.khums_due, currency)}</Text>
                  </View>
                  <StatusBadge status={currentYear.status} styles={styles} />
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryShareRow}>
                  <View style={styles.summaryShareBox}>
                    <Text style={styles.summaryShareTitle}>Sahm-e-Imam</Text>
                    <Text style={styles.summaryShareDue}>{fmt(currentYear.sahm_imam, currency)}</Text>
                    <Text style={styles.summaryShareSub}>
                      Paid {fmt(currentYear.paid_imam, currency)} · Rem {fmt(currentYear.sahm_imam - currentYear.paid_imam, currency)}
                    </Text>
                  </View>
                  <View style={styles.summaryShareBox}>
                    <Text style={styles.summaryShareTitle}>Sahm-e-Sadat</Text>
                    <Text style={styles.summaryShareDue}>{fmt(currentYear.sahm_sadat, currency)}</Text>
                    <Text style={styles.summaryShareSub}>
                      Paid {fmt(currentYear.paid_sadat, currency)} · Rem {fmt(currentYear.sahm_sadat - currentYear.paid_sadat, currency)}
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryDivider} />
                <View style={styles.summaryBottomRow}>
                  <Text style={styles.summaryMeta}>Surplus: {fmt(currentYear.surplus, currency)}</Text>
                  <Text style={styles.summaryMeta}>Rate: 20%</Text>
                </View>
              </LinearGradient>
            )}

            {/* ── Income Section ── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Income</Text>
                <TouchableOpacity
                  style={styles.sectionAction}
                  onPress={handleRefreshIncome}
                  disabled={refreshing}
                >
                  {refreshing
                    ? <ActivityIndicator size="small" color={KHUMS_PURPLE} />
                    : <RefreshCw color={KHUMS_PURPLE} size={14} />}
                  <Text style={styles.sectionActionText}>Sync Transactions</Text>
                </TouchableOpacity>
              </View>

              {currentYear && (
                <>
                  <View style={styles.incomeRow}>
                    <Text style={styles.incomeLabel}>Auto (from transactions)</Text>
                    <Text style={styles.incomeValue}>{fmt(currentYear.income_auto, currency)}</Text>
                  </View>
                  <View style={styles.incomeRow}>
                    <View style={styles.incomeRowLeft}>
                      <Text style={styles.incomeLabel}>Additional Income</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.incomeValue}>{fmt(currentYear.income_extra, currency)}</Text>
                      <TouchableOpacity
                        style={styles.incomeEditBtn}
                        onPress={() => {
                          setExtraIncome(String(currentYear.income_extra || ''));
                          setExemptIncome(String(currentYear.income_exempt || ''));
                          setShowIncome(true);
                        }}
                      >
                        <Pencil color={COLORS.textSecondary} size={14} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.incomeRow}>
                    <View style={styles.incomeRowLeft}>
                      <Text style={styles.incomeLabel}>Exempt Items</Text>
                      <View style={styles.exemptTag}>
                        <Text style={styles.exemptTagText}>−</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.incomeValue, { color: COLORS.success }]}>
                        {fmt(currentYear.income_exempt, currency)}
                      </Text>
                      <TouchableOpacity
                        style={styles.incomeEditBtn}
                        onPress={() => {
                          setExtraIncome(String(currentYear.income_extra || ''));
                          setExemptIncome(String(currentYear.income_exempt || ''));
                          setShowIncome(true);
                        }}
                      >
                        <Pencil color={COLORS.textSecondary} size={14} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[styles.incomeRow, styles.incomeRowLast]}>
                    <Text style={styles.incomeTotalLabel}>Gross Taxable Income</Text>
                    <Text style={styles.incomeTotalValue}>{fmt(grossTaxable, currency)}</Text>
                  </View>
                </>
              )}
            </View>

            {/* ── Living Expenses Section ── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Living Expenses</Text>
                  {currentYear && (
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>
                      Total: {fmt(currentYear.expenses_total, currency)}
                    </Text>
                  )}
                </View>
                <TouchableOpacity style={styles.sectionAction} onPress={() => { setExpCat('food'); setExpAmount(''); setExpDesc(''); setShowExpense(true); }}>
                  <Plus color={KHUMS_PURPLE} size={14} />
                  <Text style={styles.sectionActionText}>Add</Text>
                </TouchableOpacity>
              </View>

              {/* Category filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipsRow}>
                  <TouchableOpacity
                    style={[styles.chip, expFilter === 'all' && styles.chipActive]}
                    onPress={() => setExpFilter('all')}
                  >
                    <Text style={[styles.chipText, expFilter === 'all' && styles.chipTextActive]}>All</Text>
                  </TouchableOpacity>
                  {EXPENSE_CATEGORIES.map(c => (
                    <TouchableOpacity
                      key={c.key}
                      style={[styles.chip, expFilter === c.key && styles.chipActive]}
                      onPress={() => setExpFilter(c.key)}
                    >
                      <Text style={[styles.chipText, expFilter === c.key && styles.chipTextActive]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {filteredExpenses.length === 0 ? (
                <Text style={styles.emptyExpenses}>No expenses recorded yet. Tap + Add to start.</Text>
              ) : (
                filteredExpenses.map(exp => {
                  const CatIcon = catIcon(exp.category);
                  return (
                    <View key={exp.id} style={styles.expenseItem}>
                      <View style={styles.expenseIcon}>
                        <CatIcon color={KHUMS_PURPLE} size={16} />
                      </View>
                      <View style={styles.expenseInfo}>
                        <Text style={styles.expenseCat}>{catLabel(exp.category)}</Text>
                        {exp.description ? <Text style={styles.expenseDesc}>{exp.description}</Text> : null}
                      </View>
                      <Text style={styles.expenseAmount}>{fmt(exp.amount, currency)}</Text>
                      <TouchableOpacity style={styles.expenseDeleteBtn} onPress={() => handleDeleteExpense(exp)}>
                        <Trash2 color={COLORS.error} size={16} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>

            {/* ── Payments Section ── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Khums Payments</Text>
              </View>

              {currentYear && (
                <>
                  {/* Sahm-e-Imam */}
                  <View style={styles.paymentTypeBlock}>
                    <View style={styles.paymentTypeHeader}>
                      <Text style={styles.paymentTypeLabel}>Sahm-e-Imam</Text>
                      <Text style={styles.paymentTypeSub}>
                        {fmt(currentYear.paid_imam, currency)} / {fmt(currentYear.sahm_imam, currency)}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${imamPct}%`, backgroundColor: imamPct >= 100 ? COLORS.success : KHUMS_PURPLE }]} />
                    </View>
                    {imamPct < 100 && (
                      <TouchableOpacity
                        style={[styles.recordPayBtn, { borderColor: KHUMS_PURPLE + '60', backgroundColor: KHUMS_PURPLE + '12' }]}
                        onPress={() => { setPayType('sahm_imam'); setPayAmount(''); setPayRecipient(''); setPayNotes(''); setPayDate(new Date()); setShowPayment(true); }}
                      >
                        <DollarSign color={KHUMS_PURPLE} size={14} />
                        <Text style={[styles.recordPayBtnText, { color: KHUMS_PURPLE }]}>Record Imam's Share Payment</Text>
                      </TouchableOpacity>
                    )}
                    {imamPct >= 100 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <CheckCircle color={COLORS.success} size={16} />
                        <Text style={{ color: COLORS.success, fontSize: 12, fontWeight: '700' }}>Fully Paid</Text>
                      </View>
                    )}
                  </View>

                  {/* Sahm-e-Sadat */}
                  <View style={styles.paymentTypeBlock}>
                    <View style={styles.paymentTypeHeader}>
                      <Text style={styles.paymentTypeLabel}>Sahm-e-Sadat</Text>
                      <Text style={styles.paymentTypeSub}>
                        {fmt(currentYear.paid_sadat, currency)} / {fmt(currentYear.sahm_sadat, currency)}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${sadatPct}%`, backgroundColor: sadatPct >= 100 ? COLORS.success : '#0ea5e9' }]} />
                    </View>
                    {sadatPct < 100 && (
                      <TouchableOpacity
                        style={[styles.recordPayBtn, { borderColor: '#0ea5e960', backgroundColor: '#0ea5e912' }]}
                        onPress={() => { setPayType('sahm_sadat'); setPayAmount(''); setPayRecipient(''); setPayNotes(''); setPayDate(new Date()); setShowPayment(true); }}
                      >
                        <DollarSign color="#0ea5e9" size={14} />
                        <Text style={[styles.recordPayBtnText, { color: '#0ea5e9' }]}>Record Sadat's Share Payment</Text>
                      </TouchableOpacity>
                    )}
                    {sadatPct >= 100 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <CheckCircle color={COLORS.success} size={16} />
                        <Text style={{ color: COLORS.success, fontSize: 12, fontWeight: '700' }}>Fully Paid</Text>
                      </View>
                    )}
                  </View>

                  {/* Payment history toggle */}
                  {payments.length > 0 && (
                    <TouchableOpacity
                      style={styles.paymentHistoryToggle}
                      onPress={() => setShowPayHistory(v => !v)}
                    >
                      <Text style={styles.paymentHistoryTitle}>Payment History ({payments.length})</Text>
                      {showPayHistory
                        ? <ChevronUp color={COLORS.textSecondary} size={16} />
                        : <ChevronDown color={COLORS.textSecondary} size={16} />}
                    </TouchableOpacity>
                  )}
                  {showPayHistory && payments.map(pay => (
                    <View key={pay.id} style={styles.paymentItem}>
                      <View style={[styles.paymentDot, { backgroundColor: pay.recipient_type === 'sahm_imam' ? KHUMS_PURPLE : '#0ea5e9' }]} />
                      <View style={styles.paymentItemInfo}>
                        <Text style={styles.paymentItemAmount}>{fmt(pay.amount, currency)}</Text>
                        <Text style={styles.paymentItemSub}>
                          {pay.recipient_type === 'sahm_imam' ? 'Sahm-e-Imam' : 'Sahm-e-Sadat'}
                          {pay.recipient_name ? ` · ${pay.recipient_name}` : ''}
                          {' · '}{fmtDate(pay.date)}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.paymentDeleteBtn} onPress={() => handleDeletePayment(pay)}>
                        <Trash2 color={COLORS.error} size={16} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
            </View>

            {/* ── Notes ── */}
            <View style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                value={notesVal}
                onChangeText={handleNotesChange}
                placeholder="Add notes about this Khums year..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* FAB */}
      {years.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={() => { setExpCat('food'); setExpAmount(''); setExpDesc(''); setShowExpense(true); }}>
          <Plus color="#fff" size={26} />
        </TouchableOpacity>
      )}

      {/* ══════════════════ MODAL: New Khums Year ══════════════════ */}
      <Modal visible={showNewYear} transparent animationType="slide" onRequestClose={() => setShowNewYear(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Khums Year</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowNewYear(false)}>
                <X color={COLORS.text} size={18} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Khums Due Date (Payment Date)</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowYearPicker(true)}>
                <Calendar color={COLORS.textSecondary} size={18} />
                <Text style={styles.dateBtnText}>{fmtDate(newYearDate)}</Text>
              </TouchableOpacity>
              {showYearPicker && (
                <DateTimePicker
                  value={newYearDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => { setShowYearPicker(false); if (d) setNewYearDate(d); }}
                />
              )}
              <View style={[styles.infoBox, { marginHorizontal: 0, marginTop: 8 }]}>
                <Text style={styles.infoBoxText}>
                  Enter the date you will pay Khums this year (e.g. 25 Dec 2026). The app will automatically set your Khums year from 25 Dec 2025 to 24 Dec 2026 and sync your transactions for that period.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, savingYear && { opacity: 0.6 }]}
                onPress={handleCreateYear}
                disabled={savingYear}
              >
                {savingYear ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Khums Year</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════ MODAL: Add Expense ══════════════════ */}
      <Modal visible={showExpense} transparent animationType="slide" onRequestClose={() => setShowExpense(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Living Expense</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowExpense(false)}>
                <X color={COLORS.text} size={18} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={[styles.chipsRow, { marginBottom: 16 }]}>
                  {EXPENSE_CATEGORIES.map(c => (
                    <TouchableOpacity
                      key={c.key}
                      style={[styles.chip, expCat === c.key && styles.chipActive]}
                      onPress={() => setExpCat(c.key)}
                    >
                      <Text style={[styles.chipText, expCat === c.key && styles.chipTextActive]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.fieldLabel}>Amount</Text>
              <TextInput
                style={styles.textInput}
                value={expAmount}
                onChangeText={setExpAmount}
                keyboardType="numeric"
                placeholder={`Amount in ${currency}`}
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.fieldLabel}>Description (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={expDesc}
                onChangeText={setExpDesc}
                placeholder="e.g. Monthly rent"
                placeholderTextColor={COLORS.textSecondary}
              />
              <TouchableOpacity
                style={[styles.saveBtn, (savingExp || !expAmount) && { opacity: 0.5 }]}
                onPress={handleAddExpense}
                disabled={savingExp || !expAmount}
              >
                {savingExp ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Expense</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════ MODAL: Income Edit ══════════════════ */}
      <Modal visible={showIncome} transparent animationType="slide" onRequestClose={() => setShowIncome(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Income Details</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowIncome(false)}>
                <X color={COLORS.text} size={18} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Additional Income</Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>
                Salary, business, gifts, rental, freelance — income not captured in your transactions.
              </Text>
              <TextInput
                style={styles.textInput}
                value={extraIncome}
                onChangeText={setExtraIncome}
                keyboardType="numeric"
                placeholder={`Amount in ${currency}`}
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.fieldLabel}>Exempt Income</Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>
                Mahr, inheritance, blood money (Diyah), previously Khums-paid savings, household items used in the year, women's jewelry.
              </Text>
              <TextInput
                style={styles.textInput}
                value={exemptIncome}
                onChangeText={setExemptIncome}
                keyboardType="numeric"
                placeholder={`Exempt amount in ${currency}`}
                placeholderTextColor={COLORS.textSecondary}
              />
              <View style={[styles.infoBox, { marginHorizontal: 0, marginBottom: 16 }]}>
                <Text style={styles.infoBoxText}>
                  Exempt items are deducted from your gross income before calculating the taxable surplus. They are not subject to Khums.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, savingIncome && { opacity: 0.6 }]}
                onPress={handleSaveIncome}
                disabled={savingIncome}
              >
                {savingIncome ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════ MODAL: Add Payment ══════════════════ */}
      <Modal visible={showPayment} transparent animationType="slide" onRequestClose={() => setShowPayment(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowPayment(false)}>
                <X color={COLORS.text} size={18} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Payment Type</Text>
              <View style={styles.typeToggleRow}>
                <TouchableOpacity
                  style={[styles.typeToggleBtn, payType === 'sahm_imam' && styles.typeToggleBtnActive]}
                  onPress={() => setPayType('sahm_imam')}
                >
                  <Text style={[styles.typeToggleBtnText, payType === 'sahm_imam' && styles.typeToggleBtnTextActive]}>
                    Sahm-e-Imam
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeToggleBtn, payType === 'sahm_sadat' && styles.typeToggleBtnActive]}
                  onPress={() => setPayType('sahm_sadat')}
                >
                  <Text style={[styles.typeToggleBtnText, payType === 'sahm_sadat' && styles.typeToggleBtnTextActive]}>
                    Sahm-e-Sadat
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.fieldLabel}>Amount</Text>
              <TextInput
                style={styles.textInput}
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="numeric"
                placeholder={`Amount in ${currency}`}
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.fieldLabel}>Recipient (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={payRecipient}
                onChangeText={setPayRecipient}
                placeholder="e.g. Sistani Office, Sayyid Ahmad"
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.fieldLabel}>Date</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPayDate(true)}>
                <Calendar color={COLORS.textSecondary} size={18} />
                <Text style={styles.dateBtnText}>{fmtDate(payDate)}</Text>
              </TouchableOpacity>
              {showPayDate && (
                <DateTimePicker
                  value={payDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => { setShowPayDate(false); if (d) setPayDate(d); }}
                  maximumDate={new Date()}
                />
              )}
              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={payNotes}
                onChangeText={setPayNotes}
                placeholder="Optional notes"
                placeholderTextColor={COLORS.textSecondary}
              />
              <TouchableOpacity
                style={[styles.saveBtn, (savingPay || !payAmount) && { opacity: 0.5 }]}
                onPress={handleAddPayment}
                disabled={savingPay || !payAmount}
              >
                {savingPay ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Record Payment</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default Khums;
