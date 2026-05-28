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
  Calendar, Landmark, DollarSign, CheckCircle,
  History, TrendingUp, Wallet, ArrowDownLeft,
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

const fmt = (n, cur) =>
  `${cur} ${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

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

/* ─── Breakdown Step Row ─────────────────────────────────────────── */
const StepRow = ({ label, value, color, bold, dividerAbove, COLORS, currency }) => (
  <>
    {dividerAbove && <View style={{ height: 1, backgroundColor: COLORS.divider, marginVertical: 8 }} />}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 }}>
      <Text style={{ color: bold ? COLORS.text : COLORS.textSecondary, fontSize: bold ? 14 : 13, fontWeight: bold ? '700' : '400' }}>
        {label}
      </Text>
      <Text style={{ color: color || COLORS.text, fontSize: bold ? 15 : 13, fontWeight: bold ? '800' : '600' }}>
        {fmt(value, currency)}
      </Text>
    </View>
  </>
);

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
  const [payments,   setPayments]   = useState([]);
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [syncing,    setSyncing]    = useState(false);
  const [showPayHistory,  setShowPayHistory]  = useState(false);
  const [showHistoryList, setShowHistoryList] = useState(false);
  const [notesVal,   setNotesVal]   = useState('');
  const [saveNotesTm, setSaveNotesTm] = useState(null);

  const currentYear = years[yearIdx] ?? null;

  /* ── Modals ─────────────────────────────────────────────────────── */
  const [showNewYear,    setShowNewYear]    = useState(false);
  const [showPayment,    setShowPayment]    = useState(false);
  const [showIncome,     setShowIncome]     = useState(false);
  const [showAddHistory, setShowAddHistory] = useState(false);

  // New-year form
  const [newYearDate,    setNewYearDate]    = useState(new Date());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [savingYear,     setSavingYear]     = useState(false);

  // Payment form
  const [payType,      setPayType]      = useState('sahm_imam');
  const [payRecipient, setPayRecipient] = useState('');
  const [payAmount,    setPayAmount]    = useState('');
  const [payDate,      setPayDate]      = useState(new Date());
  const [payNotes,     setPayNotes]     = useState('');
  const [showPayDate,  setShowPayDate]  = useState(false);
  const [savingPay,    setSavingPay]    = useState(false);

  // Wealth inputs form
  const [lastKhumsPaid,    setLastKhumsPaid]    = useState('');
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
        const pays = await khumsService.getPayments(yr.id);
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
    const pays = await khumsService.getPayments(yr.id);
    setPayments(pays);
    setNotesVal(yr.notes ?? '');
  };

  const switchYear = async (newIdx) => {
    setYearIdx(newIdx);
    setShowPayHistory(false);
    const freshYears = await khumsService.getYears(userId);
    setYears(freshYears);
    await reloadYear(freshYears[newIdx]);
  };

  /* ── Sync account balance ────────────────────────────────────────── */
  const handleSyncAll = async () => {
    if (!currentYear) return;
    setSyncing(true);
    try {
      const { currentWealth } = await khumsService.refreshAutoData(currentYear.id);

      const freshYears = await khumsService.getYears(userId);
      setYears(freshYears);
      const updatedYear = freshYears[yearIdx] ?? freshYears[0];
      if (updatedYear) await reloadYear(updatedYear);

      Alert.alert(
        'Synced ✓',
        `Current Account Balance: ${fmt(currentWealth, currency)}\n\nKhums re-calculated automatically based on your live account wealth.`
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

  /* ── Wealth inputs save ──────────────────────────────────────────── */
  const handleSaveWealthInputs = async () => {
    if (!currentYear) return;
    setSavingIncome(true);
    try {
      await khumsService.updateYear(currentYear.id, {
        last_khums_paid:   parseFloat(lastKhumsPaid)    || 0,
        income_receivable: parseFloat(receivableIncome) || 0,
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

      // Check if a new year was auto-created after payment settled the year
      const prevYearEnd = currentYear.year_end;
      const newYearAutoCreated = freshYears.some(y => new Date(y.year_start) > new Date(prevYearEnd));
      if (newYearAutoCreated) {
        Alert.alert(
          'Khums Fully Paid!',
          'All Khums for this year has been paid. A new Khums year has been automatically started — it will begin tracking from the next day.',
          [{ text: 'View New Year', onPress: () => setYearIdx(0) }, { text: 'OK' }]
        );
      }
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

      // Feed this payment into the current year's calculation as last_khums_paid
      if (currentYear) {
        await khumsService.updateYear(currentYear.id, {
          last_khums_paid: parseFloat(histAmount) || 0,
        });
        const freshYears = await khumsService.getYears(userId);
        setYears(freshYears);
      }

      setShowAddHistory(false);
      setHistAmount(''); setHistNotes('');
      setShowHistoryList(true); // expand list so user sees the new record
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
            else setPayments([]);
          },
        },
      ]
    );
  };

  /* ── Info alert ──────────────────────────────────────────────────── */
  const showInfo = () => Alert.alert(
    'About Khums (Sistani)',
    'Khums = 20% of new taxable wealth growth above the already-cleared threshold.\n\n' +
    'FORMULA:\n' +
    '① Last Year\'s Threshold = Last Khums Paid × 5\n' +
    '   (If you paid 50k Khums, 250k of your wealth was already taxed)\n\n' +
    '② Effective Wealth = Current Balance − Deferred Receivables\n' +
    '   (Loans outstanding you haven\'t received yet are excluded)\n\n' +
    '③ New Taxable Savings = Effective Wealth − Threshold\n' +
    '   (Only growth above the cleared threshold is taxable)\n\n' +
    '④ Khums Due = max(0, New Taxable Savings) × 20%\n\n' +
    'KEY RULES:\n' +
    '• Deferred Receivables: Money owed to you but not yet received is excluded — it is a deferred asset. Enter the outstanding balance.\n\n' +
    '• Recovered Installments: Cash already received from a debtor sits in your bank balance and is taxed normally — do NOT exclude it.\n\n' +
    '• Source-Deducted Liabilities: If an employer repays your loan from salary before it reaches you, your net salary already reflects the deduction — do NOT enter any extra deduction.\n\n' +
    '• Sahm-e-Imam (10%): Given to the Marjaʿ.\n' +
    '• Sahm-e-Sadat (10%): Given to deserving Sayyids.\n\n' +
    'Tap "Sync Account Balance" to pull your live account total as Current Wealth.',
    [{ text: 'OK' }]
  );

  /* ── Derived values ──────────────────────────────────────────────── */
  const imamPct  = currentYear
    ? Math.min(100, currentYear.sahm_imam  > 0 ? (currentYear.paid_imam  / currentYear.sahm_imam)  * 100 : 0) : 0;
  const sadatPct = currentYear
    ? Math.min(100, currentYear.sahm_sadat > 0 ? (currentYear.paid_sadat / currentYear.sahm_sadat) * 100 : 0) : 0;

  const lastYearThreshold = (currentYear?.last_khums_paid || 0) * 5;
  const effectiveWealth   = (currentYear?.current_wealth  || 0) - (currentYear?.income_receivable || 0);

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
              <View key={item.id}>
                <View style={styles.expenseItem}>
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
                {currentYear && (
                  <TouchableOpacity
                    style={{
                      marginHorizontal: 4,
                      marginBottom: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      backgroundColor: KHUMS_PURPLE + '18',
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: KHUMS_PURPLE + '40',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      alignSelf: 'flex-start',
                    }}
                    onPress={async () => {
                      await khumsService.updateYear(currentYear.id, {
                        last_khums_paid: Number(item.amount),
                      });
                      const freshYears = await khumsService.getYears(userId);
                      setYears(freshYears);
                      Alert.alert('Applied ✓', `Last Year's Khums Paid set to ${fmt(item.amount, currency)}. Calculation updated.`);
                    }}
                  >
                    <CheckCircle color={KHUMS_PURPLE} size={13} />
                    <Text style={{ color: KHUMS_PURPLE, fontSize: 12, fontWeight: '600' }}>
                      Use as Last Year's Khums Paid
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : null}

          <View style={[styles.infoBox, { marginHorizontal: 0, marginTop: 10, marginBottom: 0 }]}>
            <Text style={styles.infoBoxText}>
              Adding a record here automatically sets "Last Year's Khums Paid" in the current year's calculation, updating the protected threshold. The most recently added record is used.
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
              Set your Khums due date to begin. The app will sync your live account balance as your current wealth and calculate what you owe based on Ayatollah Sistani's rules.
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
                {syncing ? 'Syncing…' : 'Sync Account Balance'}
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
                {/* Khums Due + Status */}
                <View style={styles.summaryTopRow}>
                  <View>
                    <Text style={styles.summaryKhumsLabel}>Khums Due</Text>
                    <Text style={styles.summaryKhumsAmount}>{fmt(currentYear.khums_due, currency)}</Text>
                  </View>
                  <StatusBadge status={currentYear.status} styles={styles} />
                </View>

                {/* Wealth snapshot row */}
                <View style={styles.summaryDivider} />
                <View style={styles.summaryShareRow}>
                  <View style={styles.summaryShareBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <Wallet color="rgba(255,255,255,0.7)" size={12} />
                      <Text style={styles.summaryShareTitle}>Current Balance</Text>
                    </View>
                    <Text style={[styles.summaryShareDue, { color: '#86efac' }]}>
                      {fmt(currentYear.current_wealth || 0, currency)}
                    </Text>
                    <Text style={styles.summaryShareSub}>Live account total</Text>
                  </View>
                  <View style={styles.summaryShareBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <ArrowDownLeft color="rgba(255,255,255,0.7)" size={12} />
                      <Text style={styles.summaryShareTitle}>Deferred Receivables</Text>
                    </View>
                    <Text style={[styles.summaryShareDue, { color: '#fca5a5' }]}>
                      {fmt(currentYear.income_receivable || 0, currency)}
                    </Text>
                    <Text style={styles.summaryShareSub}>Loans not yet recovered</Text>
                  </View>
                </View>

                {/* Threshold + Taxable row */}
                <View style={styles.summaryDivider} />
                <View style={styles.summaryShareRow}>
                  <View style={styles.summaryShareBox}>
                    <Text style={styles.summaryShareTitle}>Last Year's Threshold</Text>
                    <Text style={styles.summaryShareDue}>
                      {fmt(lastYearThreshold, currency)}
                    </Text>
                    <Text style={styles.summaryShareSub}>
                      {fmt(currentYear.last_khums_paid || 0, currency)} × 5
                    </Text>
                  </View>
                  <View style={styles.summaryShareBox}>
                    <Text style={styles.summaryShareTitle}>New Taxable Savings</Text>
                    <Text style={[styles.summaryShareDue, { color: currentYear.surplus > 0 ? '#fbbf24' : '#86efac' }]}>
                      {fmt(currentYear.surplus, currency)}
                    </Text>
                    <Text style={styles.summaryShareSub}>× 20% = Khums Due</Text>
                  </View>
                </View>

                {/* No surplus notice */}
                {currentYear.surplus <= 0 && (currentYear.current_wealth > 0) && (
                  <View style={{
                    marginTop: 10,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    padding: 10,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', opacity: 0.9 }}>
                      No Khums due — your wealth has not grown above last year's cleared threshold.
                    </Text>
                  </View>
                )}

                {/* Sahm breakdown */}
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <Text style={styles.sectionTitle}>Calculation Breakdown</Text>
                  <TouchableOpacity
                    style={[styles.sectionAction, { paddingHorizontal: 10, paddingVertical: 6 }]}
                    onPress={() => {
                      setLastKhumsPaid(String(currentYear.last_khums_paid || ''));
                      setReceivableIncome(String(currentYear.income_receivable || ''));
                      setShowIncome(true);
                    }}
                  >
                    <Pencil color={KHUMS_PURPLE} size={13} />
                    <Text style={styles.sectionActionText}>Edit Inputs</Text>
                  </TouchableOpacity>
                </View>

                <StepRow
                  label="Current Account Balance"
                  value={currentYear.current_wealth || 0}
                  color={COLORS.success}
                  COLORS={COLORS}
                  currency={currency}
                />
                <StepRow
                  label="− Deferred Receivables"
                  value={currentYear.income_receivable || 0}
                  color={COLORS.error}
                  COLORS={COLORS}
                  currency={currency}
                />
                <StepRow
                  label="= Effective Wealth"
                  value={effectiveWealth}
                  bold
                  COLORS={COLORS}
                  currency={currency}
                  dividerAbove
                />
                {/* Last year threshold block */}
                <View style={{ height: 1, backgroundColor: COLORS.divider, marginVertical: 8 }} />
                <View style={{
                  backgroundColor: COLORS.card + 'aa',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 4,
                  borderLeftWidth: 3,
                  borderLeftColor: KHUMS_PURPLE + '80',
                }}>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Last Year's Cleared Wealth (Protected Zone)
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Khums Paid Last Year</Text>
                    <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '600' }}>
                      {fmt(currentYear.last_khums_paid || 0, currency)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Total Gross Wealth Cleared (× 5)</Text>
                    <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '600' }}>
                      {fmt(lastYearThreshold, currency)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Your Retained Portion (4/5)</Text>
                    <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '600' }}>
                      {fmt(lastYearThreshold - (currentYear.last_khums_paid || 0), currency)}
                    </Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: COLORS.divider, marginVertical: 6 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                    <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700' }}>
                      − Protected Threshold (deducted)
                    </Text>
                    <Text style={{ color: KHUMS_PURPLE, fontSize: 13, fontWeight: '700' }}>
                      {fmt(lastYearThreshold, currency)}
                    </Text>
                  </View>
                </View>

                <StepRow
                  label="= New Taxable Savings"
                  value={Math.max(0, currentYear.surplus)}
                  bold
                  color={currentYear.surplus > 0 ? KHUMS_PURPLE : COLORS.success}
                  COLORS={COLORS}
                  currency={currency}
                  dividerAbove
                />

                <View style={{ height: 1, backgroundColor: COLORS.divider, marginVertical: 8 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 }}>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Khums Rate</Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' }}>20% (1/5)</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, marginTop: 2 }}>
                  <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '800' }}>Khums Due</Text>
                  <Text style={{ color: KHUMS_PURPLE, fontSize: 17, fontWeight: '900' }}>
                    {fmt(currentYear.khums_due, currency)}
                  </Text>
                </View>

                <View style={[styles.infoBox, { marginHorizontal: 0, marginTop: 12, marginBottom: 0 }]}>
                  <Text style={styles.infoBoxText}>
                    Tap "Sync Account Balance" to pull your live account total. Tap "Edit Inputs" to set last year's Khums paid and any outstanding receivables.
                  </Text>
                </View>
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

      {/* ══ MODAL: New Khums Year ══ */}
      <Modal visible={showNewYear} transparent animationType="slide" onRequestClose={() => setShowNewYear(false)}>
        <KeyboardAvoidingView style={[styles.modalOverlay, { justifyContent: 'flex-end' }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
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
        <KeyboardAvoidingView style={[styles.modalOverlay, { justifyContent: 'flex-end' }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
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

      {/* ══ MODAL: Wealth Inputs ══ */}
      <Modal visible={showIncome} transparent animationType="slide" onRequestClose={() => setShowIncome(false)}>
        <KeyboardAvoidingView style={[styles.modalOverlay, { justifyContent: 'flex-end' }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Wealth Inputs</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowIncome(false)}>
                <X color={COLORS.text} size={18} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={[styles.infoBox, { marginHorizontal: 0, marginBottom: 16 }]}>
                <Text style={styles.infoBoxText}>
                  These two values drive the entire Khums calculation. Your live account balance is pulled automatically via Sync — only enter inputs that cannot be read from your accounts.
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Last Year's Khums Paid</Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>
                The total Khums you paid at the end of the previous year. This is multiplied by 5 to reconstruct the gross wealth pool that was already cleared (the "threshold"). Wealth below this threshold is not taxed again.
              </Text>
              <TextInput
                style={styles.textInput}
                value={lastKhumsPaid}
                onChangeText={setLastKhumsPaid}
                keyboardType="numeric"
                placeholder={`e.g. 50,000 in ${currency}`}
                placeholderTextColor={COLORS.textSecondary}
              />

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Deferred Receivables (Outstanding Loans)</Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 }}>
                Money owed to you that has NOT yet been received on Khums day (e.g. you lent a friend 10 Lac and they repaid 3 Lac — enter 7 Lac here).{'\n\n'}
                This is SUBTRACTED from your balance before calculating Khums. Cash already received sits in your accounts and is taxed normally — do NOT deduct it here.{'\n\n'}
                NOTE: Salary-deducted loan repayments are already reflected in your net salary. Do NOT enter them here.
              </Text>
              <TextInput
                style={styles.textInput}
                value={receivableIncome}
                onChangeText={setReceivableIncome}
                keyboardType="numeric"
                placeholder={`Outstanding amount in ${currency}`}
                placeholderTextColor={COLORS.textSecondary}
              />

              <TouchableOpacity
                style={[styles.saveBtn, savingIncome && { opacity: 0.6 }]}
                onPress={handleSaveWealthInputs}
                disabled={savingIncome}
              >
                {savingIncome ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save & Recalculate</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══ MODAL: Record Payment ══ */}
      <Modal visible={showPayment} transparent animationType="slide" onRequestClose={() => setShowPayment(false)}>
        <KeyboardAvoidingView style={[styles.modalOverlay, { justifyContent: 'flex-end' }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
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
