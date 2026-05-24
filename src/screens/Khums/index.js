import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Modal, Platform,
  KeyboardAvoidingView,
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
  History, TrendingUp, TrendingDown,
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

const fmt = (n, cur) =>
  `${cur} ${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const catIcon  = (key) => (EXPENSE_CATEGORIES.find(c => c.key === key) || { Icon: MoreHorizontal }).Icon;
const catLabel = (key) => (EXPENSE_CATEGORIES.find(c => c.key === key) || { label: key }).label;

/* ─── Status badge ───────────────────────────────────────────────── */
const StatusBadge = ({ status, styles }) => {
  const cfg = {
    open:    { bg: 'rgba(255,255,255,0.15)', text: '#fff',    label: 'Open' },
    partial: { bg: 'rgba(251,191,36,0.3)',   text: '#fbbf24', label: 'Partial' },
    settled: { bg: 'rgba(34,197,94,0.3)',    text: '#22c55e', label: 'Settled ✓' },
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
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [syncing,    setSyncing]    = useState(false);
  const [showPayHistory,  setShowPayHistory]  = useState(false);
  const [showHistoryList, setShowHistoryList] = useState(true);
  const [expFilter,  setExpFilter]  = useState('all');
  const [notesVal,   setNotesVal]   = useState('');
  const [saveNotesTm, setSaveNotesTm] = useState(null);

  const currentYear = years[yearIdx] ?? null;

  /* ── Modals ─────────────────────────────────────────────────────── */
  const [showNewYear,    setShowNewYear]    = useState(false);
  const [showExpense,    setShowExpense]    = useState(false);
  const [showPayment,    setShowPayment]    = useState(false);
  const [showIncome,     setShowIncome]     = useState(false);
  const [showAddHistory, setShowAddHistory] = useState(false);

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
  const [extraIncome,      setExtraIncome]      = useState('');
  const [exemptIncome,     setExemptIncome]     = useState('');
  const [receivableIncome, setReceivableIncome] = useState('');
  const [savingIncome,     setSavingIncome]     = useState(false);

  // History form
  const [histDate,    setHistDate]    = useState(new Date());
  const [histAmount,  setHistAmount]  = useState('');
  const [histNotes,   setHistNotes]   = useState('');
  const [showHistPicker, setShowHistPicker] = useState(false);
  const [savingHist,  setSavingHist]  = useState(false);

  /* ── Fetch ──────────────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [ys, hist] = await Promise.all([
        khumsService.getYears(userId),
        khumsService.getHistory(userId),
      ]);
      setYears(ys);
      setHistory(hist);
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

  const reloadYear = async (yr) => {
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
    const freshYears = await khumsService.getYears(userId);
    setYears(freshYears);
    await reloadYear(freshYears[newIdx]);
  };

  /* ── Sync all from transactions ──────────────────────────────────── */
  const handleSyncAll = async () => {
    if (!currentYear) return;
    setSyncing(true);
    try {
      const { income, expenses: exp, yearStart, effectiveEnd, txCount } =
        await khumsService.refreshAutoData(currentYear.id);

      // Reload everything so Summary card, Breakdown, and payment bars all reflect new values
      const freshYears = await khumsService.getYears(userId);
      setYears(freshYears);
      const updatedYear = freshYears[yearIdx] ?? freshYears[0];
      if (updatedYear) await reloadYear(updatedYear);

      Alert.alert(
        'Synced ✓',
        `Income: ${fmt(income, currency)}\nExpenses: ${fmt(exp, currency)}\n\n` +
        `${txCount} transaction(s) found\n` +
        `Period: ${fmtDate(yearStart)} → ${fmtDate(effectiveEnd)}\n\n` +
        `Khums re-calculated automatically.`
      );
    } catch (e) {
      Alert.alert('Sync Error', e.message);
    } finally {
      setSyncing(false);
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
      await reloadYear(freshYears[0]);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingYear(false);
    }
  };

  /* ── Add expense (manual extra) ──────────────────────────────────── */
  const handleAddExpense = async () => {
    if (!expAmount || !currentYear) return;
    setSavingExp(true);
    try {
      await khumsService.addExpense(userId, currentYear.id, {
        category: expCat, amount: expAmount, description: expDesc,
      });
      setShowExpense(false);
      setExpAmount(''); setExpDesc('');
      const [freshYears, exps] = await Promise.all([
        khumsService.getYears(userId),
        khumsService.getExpenses(currentYear.id),
      ]);
      setYears(freshYears);
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

  /* ── Income edits ────────────────────────────────────────────────── */
  const handleSaveIncome = async () => {
    if (!currentYear) return;
    setSavingIncome(true);
    try {
      await khumsService.updateYear(currentYear.id, {
        income_extra:       parseFloat(extraIncome)       || 0,
        income_exempt:      parseFloat(exemptIncome)      || 0,
        income_receivable:  parseFloat(receivableIncome)  || 0,
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
        amount:         payAmount,
        date:           payDate.toISOString(),
        notes:          payNotes,
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

  /* ── History ─────────────────────────────────────────────────────── */
  const handleAddHistory = async () => {
    if (!histAmount) return;
    setSavingHist(true);
    try {
      await khumsService.addHistory(userId, {
        payment_date: histDate.toISOString(),
        amount:       histAmount,
        notes:        histNotes,
      });
      setShowAddHistory(false);
      setHistAmount(''); setHistNotes('');
      setHistory(await khumsService.getHistory(userId));
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingHist(false);
    }
  };

  const handleDeleteHistory = (item) => {
    Alert.alert('Delete Record', `Remove historical Khums payment of ${fmt(item.amount, currency)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await khumsService.deleteHistory(item.id);
          setHistory(await khumsService.getHistory(userId));
        },
      },
    ]);
  };

  /* ── Notes auto-save ─────────────────────────────────────────────── */
  const handleNotesChange = (text) => {
    setNotesVal(text);
    if (saveNotesTm) clearTimeout(saveNotesTm);
    const tm = setTimeout(async () => {
      if (currentYear) await khumsService.updateYear(currentYear.id, { notes: text });
    }, 1000);
    setSaveNotesTm(tm);
  };

  /* ── Delete year ─────────────────────────────────────────────────── */
  const handleDeleteYear = () => {
    if (!currentYear) return;
    Alert.alert(
      'Delete Khums Year',
      `Delete ${currentYear.year_label}? All data for this year will be removed.`,
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
            if (freshYears.length > 0) await reloadYear(freshYears[newIdx]);
            else { setExpenses([]); setPayments([]); }
          },
        },
      ]
    );
  };

  /* ── Info alert ──────────────────────────────────────────────────── */
  const showInfo = () => Alert.alert(
    'About Khums',
    'Khums is 20% of your annual net surplus, obligatory for Shia Muslims.\n\n' +
    '• Income & Expenses are pulled automatically from your transactions.\n' +
    '• Surplus = Income − Expenses − Exempt items.\n' +
    '• Khums Due = Surplus × 20%.\n' +
    '• Sahm-e-Imam (10%): Given to the Marjaʿ.\n' +
    '• Sahm-e-Sadat (10%): Given to deserving Sayyids.\n\n' +
    'Tap "Sync Transactions" to refresh amounts from your records.\n\n' +
    'Based on rulings of Ayatollah Sistani.',
    [{ text: 'OK' }]
  );

  /* ── Derived values ──────────────────────────────────────────────── */
  const filteredExpenses = useMemo(() =>
    expFilter === 'all' ? expenses : expenses.filter(e => e.category === expFilter),
    [expenses, expFilter]
  );
  const imamPct  = currentYear
    ? Math.min(100, currentYear.sahm_imam  > 0 ? (currentYear.paid_imam  / currentYear.sahm_imam)  * 100 : 0) : 0;
  const sadatPct = currentYear
    ? Math.min(100, currentYear.sahm_sadat > 0 ? (currentYear.paid_sadat / currentYear.sahm_sadat) * 100 : 0) : 0;
  const grossTaxable = currentYear
    ? Math.max(0, (currentYear.income_auto + currentYear.income_extra + (currentYear.income_receivable || 0)) - currentYear.income_exempt) : 0;
  const totalDeductions = currentYear
    ? (currentYear.expenses_auto || 0) + currentYear.expenses_total - (currentYear.expenses_auto || 0) + (currentYear.expenses_auto || 0)
    : 0;
  // expenses_total already = expenses_auto + manual in recalculate

  /* ─────────────────────────────────────────────────────────────────*/

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

        {/* ── Previous Khums History (always visible) ── */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowHistoryList(v => !v)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <History color={KHUMS_PURPLE} size={16} />
              <Text style={styles.sectionTitle}>Previous Khums Records</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                style={styles.sectionAction}
                onPress={() => { setHistAmount(''); setHistNotes(''); setHistDate(new Date()); setShowAddHistory(true); }}
              >
                <Plus color={KHUMS_PURPLE} size={14} />
                <Text style={styles.sectionActionText}>Add Record</Text>
              </TouchableOpacity>
              {showHistoryList
                ? <ChevronUp color={COLORS.textSecondary} size={16} />
                : <ChevronDown color={COLORS.textSecondary} size={16} />}
            </View>
          </TouchableOpacity>

          {history.length === 0 ? (
            <Text style={styles.emptyExpenses}>
              No previous records. Tap "Add Record" to log your last Khums payment for reference.
            </Text>
          ) : showHistoryList ? (
            history.map(item => (
              <View key={item.id} style={styles.expenseItem}>
                <View style={[styles.expenseIcon, { backgroundColor: KHUMS_PURPLE + '22' }]}>
                  <History color={KHUMS_PURPLE} size={16} />
                </View>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseCat}>{fmtDate(item.payment_date)}</Text>
                  {item.notes ? <Text style={styles.expenseDesc}>{item.notes}</Text> : null}
                </View>
                <Text style={[styles.expenseAmount, { color: KHUMS_PURPLE }]}>
                  {fmt(item.amount, currency)}
                </Text>
                <TouchableOpacity style={styles.expenseDeleteBtn} onPress={() => handleDeleteHistory(item)}>
                  <Trash2 color={COLORS.error} size={16} />
                </TouchableOpacity>
              </View>
            ))
          ) : null}

          <View style={[styles.infoBox, { marginHorizontal: 0, marginTop: 10, marginBottom: 0 }]}>
            <Text style={styles.infoBoxText}>
              These are reference records only — they do not affect the current year's calculation. The current year tracks income and expenses from your transactions automatically.
            </Text>
          </View>
        </View>

        {/* ── No years empty state ── */}
        {years.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Landmark color={KHUMS_PURPLE} size={36} />
            </View>
            <Text style={styles.emptyTitle}>Start Tracking Khums</Text>
            <Text style={styles.emptySubtitle}>
              Set your Khums due date to begin. The app will automatically pull your income and expenses from transactions and calculate what you owe.
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

            {/* ── Sync button ── */}
            <TouchableOpacity
              style={[styles.sectionCard, {
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 10, paddingVertical: 14, backgroundColor: KHUMS_PURPLE + '12',
                borderColor: KHUMS_PURPLE + '44',
              }]}
              onPress={handleSyncAll}
              disabled={syncing}
            >
              {syncing
                ? <ActivityIndicator size="small" color={KHUMS_PURPLE} />
                : <RefreshCw color={KHUMS_PURPLE} size={18} />}
              <Text style={{ color: KHUMS_PURPLE, fontSize: 14, fontWeight: '700' }}>
                {syncing ? 'Syncing Transactions…' : 'Sync Income & Expenses from Transactions'}
              </Text>
            </TouchableOpacity>

            {/* ── Summary Card ── */}
            {currentYear && (
              <LinearGradient
                colors={['#7c3aed', '#4f46e5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.summaryCard}
              >
                {/* Top: Khums Due + Status */}
                <View style={styles.summaryTopRow}>
                  <View>
                    <Text style={styles.summaryKhumsLabel}>Khums Due</Text>
                    <Text style={styles.summaryKhumsAmount}>{fmt(currentYear.khums_due, currency)}</Text>
                  </View>
                  <StatusBadge status={currentYear.status} styles={styles} />
                </View>

                {/* Income / Expenses mini-summary — always visible */}
                <View style={styles.summaryDivider} />
                <View style={styles.summaryShareRow}>
                  <View style={styles.summaryShareBox}>
                    <Text style={styles.summaryShareTitle}>Total Income</Text>
                    <Text style={[styles.summaryShareDue, { color: '#86efac' }]}>
                      {fmt((currentYear.income_auto || 0) + (currentYear.income_extra || 0) + (currentYear.income_receivable || 0) - (currentYear.income_exempt || 0), currency)}
                    </Text>
                    <Text style={styles.summaryShareSub}>Auto + Manual − Exempt</Text>
                  </View>
                  <View style={styles.summaryShareBox}>
                    <Text style={styles.summaryShareTitle}>Total Expenses</Text>
                    <Text style={[styles.summaryShareDue, { color: '#fca5a5' }]}>
                      {fmt(currentYear.expenses_total || 0, currency)}
                    </Text>
                    <Text style={styles.summaryShareSub}>Auto + Manual deductions</Text>
                  </View>
                </View>

                {/* Surplus row */}
                <View style={styles.summaryDivider} />
                <View style={styles.summaryBottomRow}>
                  <Text style={styles.summaryMeta}>
                    Net Surplus: {fmt(currentYear.surplus, currency)}
                  </Text>
                  <Text style={styles.summaryMeta}>Rate: 20%</Text>
                </View>

                {/* No-surplus notice */}
                {currentYear.surplus === 0 && (currentYear.income_auto > 0 || currentYear.expenses_total > 0) && (
                  <View style={{
                    marginTop: 10,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    padding: 10,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', opacity: 0.9 }}>
                      No Khums due — living expenses exceed income this year.{'\n'}
                      Add any unrecorded income via "Additional (manual)" if needed.
                    </Text>
                  </View>
                )}

                {/* Sahm breakdown — only when Khums > 0 */}
                {currentYear.khums_due > 0 && (
                  <>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryShareRow}>
                      <View style={styles.summaryShareBox}>
                        <Text style={styles.summaryShareTitle}>Sahm-e-Imam</Text>
                        <Text style={styles.summaryShareDue}>{fmt(currentYear.sahm_imam, currency)}</Text>
                        <Text style={styles.summaryShareSub}>
                          Paid {fmt(currentYear.paid_imam, currency)} · Rem {fmt(Math.max(0, currentYear.sahm_imam - currentYear.paid_imam), currency)}
                        </Text>
                      </View>
                      <View style={styles.summaryShareBox}>
                        <Text style={styles.summaryShareTitle}>Sahm-e-Sadat</Text>
                        <Text style={styles.summaryShareDue}>{fmt(currentYear.sahm_sadat, currency)}</Text>
                        <Text style={styles.summaryShareSub}>
                          Paid {fmt(currentYear.paid_sadat, currency)} · Rem {fmt(Math.max(0, currentYear.sahm_sadat - currentYear.paid_sadat), currency)}
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </LinearGradient>
            )}

            {/* ── Calculation Breakdown ── */}
            {currentYear && (
              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Calculation Breakdown</Text>

                {/* Income block */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <TrendingUp color={COLORS.success} size={14} />
                  <Text style={{ color: COLORS.success, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
                    Income
                  </Text>
                </View>
                <View style={styles.incomeRow}>
                  <Text style={styles.incomeLabel}>From Transactions (auto)</Text>
                  <Text style={styles.incomeValue}>{fmt(currentYear.income_auto, currency)}</Text>
                </View>
                <View style={styles.incomeRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.incomeLabel}>Additional (manual)</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.incomeValue}>{fmt(currentYear.income_extra, currency)}</Text>
                    <TouchableOpacity onPress={() => {
                      setExtraIncome(String(currentYear.income_extra || ''));
                      setExemptIncome(String(currentYear.income_exempt || ''));
                      setReceivableIncome(String(currentYear.income_receivable || ''));
                      setShowIncome(true);
                    }}>
                      <Pencil color={COLORS.textSecondary} size={14} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.incomeRow}>
                  <Text style={[styles.incomeLabel, { color: COLORS.success }]}>− Exempt Items</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.incomeValue, { color: COLORS.success }]}>
                      {fmt(currentYear.income_exempt, currency)}
                    </Text>
                    <TouchableOpacity onPress={() => {
                      setExtraIncome(String(currentYear.income_extra || ''));
                      setExemptIncome(String(currentYear.income_exempt || ''));
                      setReceivableIncome(String(currentYear.income_receivable || ''));
                      setShowIncome(true);
                    }}>
                      <Pencil color={COLORS.textSecondary} size={14} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.incomeRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.incomeLabel}>Receivables (Loans Given)</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.incomeValue}>{fmt(currentYear.income_receivable || 0, currency)}</Text>
                    <TouchableOpacity onPress={() => {
                      setExtraIncome(String(currentYear.income_extra || ''));
                      setExemptIncome(String(currentYear.income_exempt || ''));
                      setReceivableIncome(String(currentYear.income_receivable || ''));
                      setShowIncome(true);
                    }}>
                      <Pencil color={COLORS.textSecondary} size={14} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={[styles.incomeRow, { borderBottomWidth: 0, paddingTop: 8, marginTop: 2 }]}>
                  <Text style={styles.incomeTotalLabel}>Gross Taxable Income</Text>
                  <Text style={styles.incomeTotalValue}>{fmt(grossTaxable, currency)}</Text>
                </View>

                <View style={{ height: 1, backgroundColor: COLORS.divider, marginVertical: 14 }} />

                {/* Expenses block */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <TrendingDown color={COLORS.error} size={14} />
                  <Text style={{ color: COLORS.error, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
                    Living Expenses (Deductions)
                  </Text>
                </View>
                <View style={styles.incomeRow}>
                  <Text style={styles.incomeLabel}>From Transactions (auto)</Text>
                  <Text style={[styles.incomeValue, { color: COLORS.error }]}>
                    {fmt(currentYear.expenses_auto || 0, currency)}
                  </Text>
                </View>
                <View style={styles.incomeRow}>
                  <Text style={styles.incomeLabel}>Manual Additions</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.incomeValue, { color: COLORS.error }]}>
                      {fmt((currentYear.expenses_total || 0) - (currentYear.expenses_auto || 0), currency)}
                    </Text>
                    <TouchableOpacity onPress={() => { setExpCat('food'); setExpAmount(''); setExpDesc(''); setShowExpense(true); }}>
                      <Plus color={COLORS.textSecondary} size={14} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={[styles.incomeRow, { borderBottomWidth: 0, paddingTop: 8, marginTop: 2 }]}>
                  <Text style={styles.incomeTotalLabel}>Total Deductions</Text>
                  <Text style={[styles.incomeTotalValue, { color: COLORS.error }]}>
                    {fmt(currentYear.expenses_total, currency)}
                  </Text>
                </View>

                <View style={{ height: 1, backgroundColor: COLORS.divider, marginVertical: 14 }} />

                {/* Surplus row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700' }}>Net Surplus</Text>
                  <Text style={{ color: currentYear.surplus > 0 ? KHUMS_PURPLE : COLORS.success, fontSize: 16, fontWeight: '800' }}>
                    {fmt(currentYear.surplus, currency)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Khums (20% of surplus)</Text>
                  <Text style={{ color: KHUMS_PURPLE, fontSize: 15, fontWeight: '800' }}>
                    {fmt(currentYear.khums_due, currency)}
                  </Text>
                </View>
              </View>
            )}

            {/* ── Manual Expense List ── */}
            {expenses.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Manual Expense Entries</Text>
                  <TouchableOpacity style={styles.sectionAction} onPress={() => { setExpCat('food'); setExpAmount(''); setExpDesc(''); setShowExpense(true); }}>
                    <Plus color={KHUMS_PURPLE} size={14} />
                    <Text style={styles.sectionActionText}>Add</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipsRow}>
                    <TouchableOpacity style={[styles.chip, expFilter === 'all' && styles.chipActive]} onPress={() => setExpFilter('all')}>
                      <Text style={[styles.chipText, expFilter === 'all' && styles.chipTextActive]}>All</Text>
                    </TouchableOpacity>
                    {EXPENSE_CATEGORIES.map(c => (
                      <TouchableOpacity key={c.key}
                        style={[styles.chip, expFilter === c.key && styles.chipActive]}
                        onPress={() => setExpFilter(c.key)}
                      >
                        <Text style={[styles.chipText, expFilter === c.key && styles.chipTextActive]}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {filteredExpenses.map(exp => {
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
                })}
              </View>
            )}

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
                    {imamPct < 100 ? (
                      <TouchableOpacity
                        style={[styles.recordPayBtn, { borderColor: KHUMS_PURPLE + '60', backgroundColor: KHUMS_PURPLE + '12' }]}
                        onPress={() => { setPayType('sahm_imam'); setPayAmount(''); setPayRecipient(''); setPayNotes(''); setPayDate(new Date()); setShowPayment(true); }}
                      >
                        <DollarSign color={KHUMS_PURPLE} size={14} />
                        <Text style={[styles.recordPayBtnText, { color: KHUMS_PURPLE }]}>Record Imam's Share Payment</Text>
                      </TouchableOpacity>
                    ) : (
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
                    {sadatPct < 100 ? (
                      <TouchableOpacity
                        style={[styles.recordPayBtn, { borderColor: '#0ea5e960', backgroundColor: '#0ea5e912' }]}
                        onPress={() => { setPayType('sahm_sadat'); setPayAmount(''); setPayRecipient(''); setPayNotes(''); setPayDate(new Date()); setShowPayment(true); }}
                      >
                        <DollarSign color="#0ea5e9" size={14} />
                        <Text style={[styles.recordPayBtnText, { color: '#0ea5e9' }]}>Record Sadat's Share Payment</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <CheckCircle color={COLORS.success} size={16} />
                        <Text style={{ color: COLORS.success, fontSize: 12, fontWeight: '700' }}>Fully Paid</Text>
                      </View>
                    )}
                  </View>

                  {payments.length > 0 && (
                    <TouchableOpacity style={styles.paymentHistoryToggle} onPress={() => setShowPayHistory(v => !v)}>
                      <Text style={styles.paymentHistoryTitle}>Payment History ({payments.length})</Text>
                      {showPayHistory ? <ChevronUp color={COLORS.textSecondary} size={16} /> : <ChevronDown color={COLORS.textSecondary} size={16} />}
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
                placeholder="Add notes about this Khums year…"
                placeholderTextColor={COLORS.textSecondary}
                multiline
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* FAB — add manual expense */}
      {years.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={() => { setExpCat('food'); setExpAmount(''); setExpDesc(''); setShowExpense(true); }}>
          <Plus color="#fff" size={26} />
        </TouchableOpacity>
      )}

      {/* ══ MODAL: New Khums Year ══ */}
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
                  Enter the date you NEXT pay Khums (e.g. 25 Dec 2026).{'\n\n'}
                  The year will be set automatically:{'\n'}
                  • Starts: 26 Dec 2025 (day after last payment){'\n'}
                  • Ends: 25 Dec 2026 (your next due date){'\n\n'}
                  Per Sistani: the Khums year begins the day after your previous payment.
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

      {/* ══ MODAL: Add Previous Khums Record ══ */}
      <Modal visible={showAddHistory} transparent animationType="slide" onRequestClose={() => setShowAddHistory(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Previous Khums Record</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowAddHistory(false)}>
                <X color={COLORS.text} size={18} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={[styles.infoBox, { marginHorizontal: 0, marginBottom: 16 }]}>
                <Text style={styles.infoBoxText}>
                  Record a past Khums payment for reference (e.g. "Paid 5 Lac on 25 Dec 2025"). This does not affect the current year's calculation — it's for your records only.
                </Text>
              </View>
              <Text style={styles.fieldLabel}>Date Paid</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowHistPicker(true)}>
                <Calendar color={COLORS.textSecondary} size={18} />
                <Text style={styles.dateBtnText}>{fmtDate(histDate)}</Text>
              </TouchableOpacity>
              {showHistPicker && (
                <DateTimePicker
                  value={histDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => { setShowHistPicker(false); if (d) setHistDate(d); }}
                  maximumDate={new Date()}
                />
              )}
              <Text style={styles.fieldLabel}>Amount Paid</Text>
              <TextInput
                style={styles.textInput}
                value={histAmount}
                onChangeText={setHistAmount}
                keyboardType="numeric"
                placeholder={`Total Khums paid in ${currency}`}
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={histNotes}
                onChangeText={setHistNotes}
                placeholder="e.g. Paid via Sistani office"
                placeholderTextColor={COLORS.textSecondary}
              />
              <TouchableOpacity
                style={[styles.saveBtn, (savingHist || !histAmount) && { opacity: 0.5 }]}
                onPress={handleAddHistory}
                disabled={savingHist || !histAmount}
              >
                {savingHist ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Record</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══ MODAL: Manual Expense ══ */}
      <Modal visible={showExpense} transparent animationType="slide" onRequestClose={() => setShowExpense(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Manual Expense</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowExpense(false)}>
                <X color={COLORS.text} size={18} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={[styles.infoBox, { marginHorizontal: 0, marginBottom: 16 }]}>
                <Text style={styles.infoBoxText}>
                  Add expenses that are not captured in your transactions (e.g. cash spending, unrecorded bills).
                </Text>
              </View>
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={[styles.chipsRow, { marginBottom: 16 }]}>
                  {EXPENSE_CATEGORIES.map(c => (
                    <TouchableOpacity key={c.key}
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
                placeholder="e.g. Monthly rent (cash)"
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

      {/* ══ MODAL: Income Edit ══ */}
      <Modal visible={showIncome} transparent animationType="slide" onRequestClose={() => setShowIncome(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adjust Income</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowIncome(false)}>
                <X color={COLORS.text} size={18} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Additional Income (not in transactions)</Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>
                Gifts, business cash, freelance etc. not recorded in your transactions.
              </Text>
              <TextInput
                style={styles.textInput}
                value={extraIncome}
                onChangeText={setExtraIncome}
                keyboardType="numeric"
                placeholder={`Amount in ${currency}`}
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.fieldLabel}>Receivables / Loans Given (outstanding)</Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>
                Money you lent to others that is still owed to you at year-end (e.g. 10 Lac given to a friend). Per Sistani, this remains YOUR Khums-liable asset.
              </Text>
              <TextInput
                style={styles.textInput}
                value={receivableIncome}
                onChangeText={setReceivableIncome}
                keyboardType="numeric"
                placeholder={`Outstanding amount in ${currency}`}
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.fieldLabel}>Exempt Income</Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>
                Mahr, valid inheritance, blood money (Diyah), previously Khums-paid savings, women's jewelry.
              </Text>
              <TextInput
                style={styles.textInput}
                value={exemptIncome}
                onChangeText={setExemptIncome}
                keyboardType="numeric"
                placeholder={`Exempt amount in ${currency}`}
                placeholderTextColor={COLORS.textSecondary}
              />
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

      {/* ══ MODAL: Record Payment ══ */}
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
