import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Modal, Platform,
  KeyboardAvoidingView, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Menu, Plus, X, Calendar, TrendingUp, TrendingDown,
  Wallet, Pencil, Trash2, ChevronDown, ChevronUp,
  CheckCircle, History, ArrowDownLeft, ArrowUpRight, RefreshCw, Info,
} from 'lucide-react-native';
import HeaderMenu from '../../components/HeaderMenu';
import HeaderPlusButton from '../../components/HeaderPlusButton';
import { useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useTheme } from '../../context/ThemeContext';
import { makeStyles } from './styles';
import { loanService } from '../../services/loanService';
import { accountService } from '../../services/accountService';

/* ─── helpers ────────────────────────────────────────────────────────── */

const fmt = (n, cur) => `${cur} ${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const initials = (name) => (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const GIVEN = 'given';
const RECEIVED = 'received';

/* ─── Progress bar ────────────────────────────────────────────────────── */
const ProgressBar = ({ paid, total, color, styles, COLORS }) => {
  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
  return (
    <>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>
          {fmt(paid, '')} paid  ·  {fmt(total - paid, '')} remaining
        </Text>
        <Text style={[styles.progressPct, { color }]}>{pct.toFixed(0)}%</Text>
      </View>
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN SCREEN
═══════════════════════════════════════════════════════════════════════ */

const LoanManagement = () => {
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const { currency } = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();

  /* ── Data ───────────────────────────────────────────────────────── */
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('active'); // 'active' | 'archive'
  const [tab, setTab] = useState('all');
  const [expanded, setExpanded] = useState(null);

  /* ── Add-loan modal ─────────────────────────────────────────────── */
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [loanType, setLoanType] = useState(GIVEN);
  const [personName, setPersonName] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanDate, setLoanDate] = useState(new Date());
  const [loanDueDate, setLoanDueDate] = useState(new Date());
  const [loanNotes, setLoanNotes] = useState('');
  const [showLoanDate, setShowLoanDate] = useState(false);
  const [showLoanDueDate, setShowLoanDueDate] = useState(false);
  const [savingLoan, setSavingLoan] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [repaymentType, setRepaymentType] = useState('single'); // 'single' or 'multi'
  const [defineBy, setDefineBy] = useState('count'); // 'count' or 'amount'
  const [numInstallments, setNumInstallments] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [installmentInterval, setInstallmentInterval] = useState('monthly');

  /* ── Add-payment modal ──────────────────────────────────────────── */
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentLoan, setPaymentLoan] = useState(null);
  const [editingPaymentItem, setEditingPaymentItem] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentNotes, setPaymentNotes] = useState('');
  const [showPayDate, setShowPayDate] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentAccount, setPaymentAccount] = useState(null);
  const [defaultPaymentAccountId, setDefaultPaymentAccountId] = useState(null);

  /* ── Fetch ──────────────────────────────────────────────────────── */
  const fetchLoans = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [enriched, accts, defaultAcct] = await Promise.all([
        loanService.getLoans(userId),
        accountService.getAccounts(userId).catch(() => []),
        loanService.getDefaultPaymentAccount(userId),
      ]);
      setLoans(enriched);
      setAccounts(accts);
      setDefaultPaymentAccountId(defaultAcct?.id || null);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { fetchLoans(); }, [fetchLoans]));

  /* ── Summary figures (based on statusTab) ──────────────────────── */
  const summary = useMemo(() => {
    const pool = loans.filter(l => statusTab === 'active' ? !l.is_settled : l.is_settled);
    const given = pool.filter(l => l.type === GIVEN);
    const received = pool.filter(l => l.type === RECEIVED);
    return {
      totalGiven: given.reduce((s, l) => s + parseFloat(l.total_amount), 0),
      totalReceived: received.reduce((s, l) => s + parseFloat(l.total_amount), 0),
      remainingGiven: given.reduce((s, l) => s + l.remaining, 0),
      remainingReceived: received.reduce((s, l) => s + l.remaining, 0),
    };
  }, [loans, statusTab]);

  /* ── Filtered list ──────────────────────────────────────────────── */
  const filteredLoans = useMemo(() => {
    return loans
      .filter(l => statusTab === 'active' ? !l.is_settled : l.is_settled)
      .filter(l => tab === 'all' || l.type === tab);
  }, [loans, statusTab, tab]);

  const activeCount = useMemo(() => loans.filter(l => !l.is_settled).length, [loans]);
  const archiveCount = useMemo(() => loans.filter(l => l.is_settled).length, [loans]);

  /* ── Real-time calc for modal ────────────────────────────────────── */
  const calculatedInstallmentAmount = useMemo(() => {
    if (repaymentType !== 'multi' || defineBy !== 'count') return null;
    const amt = parseFloat(loanAmount);
    const count = parseInt(numInstallments);
    if (!amt || !count || count <= 0) return null;
    return amt / count;
  }, [loanAmount, numInstallments, repaymentType, defineBy]);

  const calculatedInstallmentCount = useMemo(() => {
    if (repaymentType !== 'multi' || defineBy !== 'amount') return null;
    const amt = parseFloat(loanAmount);
    const instAmt = parseFloat(installmentAmount);
    if (!amt || !instAmt || instAmt <= 0) return null;
    return Math.ceil(amt / instAmt);
  }, [loanAmount, installmentAmount, repaymentType, defineBy]);

  const calcRemainingCount = useMemo(() => {
    if (repaymentType !== 'multi') return null;
    const totalInst = defineBy === 'amount'
      ? calculatedInstallmentCount
      : parseInt(numInstallments);
    return totalInst || null;
  }, [repaymentType, defineBy, calculatedInstallmentCount, numInstallments]);

  /* ══ LOAN CRUD ══════════════════════════════════════════════════════ */

  const openAddLoan = (loan = null) => {
    setEditingLoan(loan);
    setLoanType(loan?.type || GIVEN);
    setPersonName(loan?.person_name || '');
    setLoanAmount(loan ? String(loan.total_amount) : '');
    setLoanDate(loan ? new Date(loan.date) : new Date());
    setLoanDueDate(loan?.due_date ? new Date(loan.due_date) : new Date());
    setLoanNotes(loan?.notes || '');
    setSelectedAccount(loan?.account_id ? accounts.find(a => a.id === loan.account_id) : null);
    setRepaymentType(loan?.is_multi_installment ? 'multi' : 'single');
    setDefineBy(loan?.define_by || 'count');
    setNumInstallments(loan?.num_installments ? String(loan.num_installments) : '');
    setInstallmentAmount(loan?.installment_amount ? String(loan.installment_amount) : '');
    setInstallmentInterval(loan?.installment_interval || 'monthly');
    setShowAddLoan(true);
  };

  const handleSaveLoan = async () => {
    if (!personName.trim()) return Alert.alert('Missing', 'Enter the person\'s name.');
    const amt = parseFloat(loanAmount);
    if (!amt || amt <= 0) return Alert.alert('Invalid', 'Enter a valid loan amount.');

    if (repaymentType === 'multi') {
      if (defineBy === 'count') {
        const numInst = parseInt(numInstallments);
        if (!numInst || numInst < 2) return Alert.alert('Invalid', 'Enter at least 2 installments.');
      } else {
        const instAmt = parseFloat(installmentAmount);
        if (!instAmt || instAmt <= 0) return Alert.alert('Invalid', 'Enter a valid installment amount.');
        if (instAmt >= amt) return Alert.alert('Invalid', 'Installment amount must be less than total loan amount.');
      }
    }

    setSavingLoan(true);
    try {
      const payload = {
        id: editingLoan?.id,
        user_id: userId,
        account_id: selectedAccount?.id || null,
        type: loanType,
        person_name: personName.trim(),
        total_amount: amt,
        date: loanDate.toISOString(),
        due_date: loanDueDate.toISOString(),
        notes: loanNotes.trim() || null,
        is_settled: editingLoan?.is_settled ?? false,
        is_multi_installment: repaymentType === 'multi',
        repayment_type: repaymentType,
        define_by: repaymentType === 'multi' ? defineBy : null,
        installment_amount: repaymentType === 'multi' && defineBy === 'amount' ? parseFloat(installmentAmount) : null,
        num_installments: repaymentType === 'multi'
          ? (defineBy === 'count' ? parseInt(numInstallments) : null)
          : null,
        installment_interval: repaymentType === 'multi' ? installmentInterval : null,
        created_at: editingLoan?.created_at,
      };

      await loanService.saveLoan(payload, !editingLoan);
      setShowAddLoan(false);
      fetchLoans();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingLoan(false);
    }
  };

  const handleDeleteLoan = (loan) => {
    Alert.alert(
      'Delete Loan',
      `Delete the loan with ${loan.person_name}? All payments will also be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await loanService.deleteLoan(userId, loan.id);
              fetchLoans();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          }
        },
      ]
    );
  };

  const handleMarkSettled = async (loan) => {
    try {
      await loanService.markSettled(userId, loan.id, !loan.is_settled);
      fetchLoans();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  /* ══ PAYMENT CRUD ═══════════════════════════════════════════════════ */

  const openAddPayment = (loan) => {
    setPaymentLoan(loan);
    setEditingPaymentItem(null);
    setPaymentAmount('');
    setPaymentDate(new Date());
    setPaymentNotes('');
    // Pre-select: default payment account > loan's original account > null
    const preSelected = defaultPaymentAccountId
      ? accounts.find(a => a.id === defaultPaymentAccountId) || null
      : (loan.account_id ? accounts.find(a => a.id === loan.account_id) || null : null);
    setPaymentAccount(preSelected);
    setShowAddPayment(true);
  };

  const openEditPayment = (loan, pay) => {
    setPaymentLoan(loan);
    setEditingPaymentItem(pay);
    setPaymentAmount(String(pay.amount));
    setPaymentDate(pay.date ? new Date(pay.date) : (pay.due_date ? new Date(pay.due_date) : new Date()));
    setPaymentNotes(pay.notes || '');
    setShowAddPayment(true);
  };

  const handleSavePayment = async () => {
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) return Alert.alert('Invalid', 'Enter a valid payment amount.');

    if (!editingPaymentItem && amt > paymentLoan.remaining + 0.01)
      return Alert.alert('Exceeds Balance', `Remaining balance is ${fmt(paymentLoan.remaining, currency)}.`);

    setSavingPayment(true);
    try {
      if (editingPaymentItem) {
        await loanService.updatePayment(editingPaymentItem.id, {
          amount: amt,
          date: paymentDate.toISOString(),
          notes: paymentNotes.trim() || null,
        });
      } else {
        const { isSettling } = await loanService.savePayment(
          {
            date: paymentDate.toISOString(),
            notes: paymentNotes.trim() || null,
            amount: amt,
          },
          paymentLoan,
          paymentAccount?.id || null
        );
        if (isSettling) {
          Alert.alert('🎉 Fully Settled!', `The loan with ${paymentLoan.person_name} is now fully settled.`);
        }
      }

      setShowAddPayment(false);
      setEditingPaymentItem(null);
      fetchLoans();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = (paymentId, loan) => {
    Alert.alert('Delete Payment', 'Remove this payment record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await loanService.deletePayment(paymentId, loan);
            fetchLoans();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        }
      },
    ]);
  };

  /* ── Color helpers ──────────────────────────────────────────────── */
  const typeColor = (type) => type === GIVEN ? COLORS.error : COLORS.success;
  const pctColor = (pct) => pct >= 100 ? COLORS.success : pct >= 60 ? COLORS.warning : COLORS.primary;

  const showPageInfo = () => Alert.alert('About This Page', "Track money you've lent or borrowed. Record repayments and mark loans as settled.");

  /* ─────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={{ marginRight: 12 }}>
          <Menu color={COLORS.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loans</Text>
        <HeaderPlusButton onPress={() => openAddLoan()} />
        <HeaderMenu items={[
          { icon: RefreshCw, label: 'Refresh', onPress: fetchLoans },
          { icon: Info, label: 'About This Page', onPress: showPageInfo },
        ]} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary cards ── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderTopWidth: 3, borderTopColor: COLORS.error }]}>
            <View style={[styles.summaryIcon, { backgroundColor: COLORS.error + '22' }]}>
              <ArrowUpRight color={COLORS.error} size={18} />
            </View>
            <Text style={styles.summaryLabel}>Given Out</Text>
            <Text style={[styles.summaryAmount, { color: COLORS.error }]}>
              {fmt(summary.totalGiven, currency)}
            </Text>
            <Text style={[styles.summaryLabel, { marginTop: 4 }]}>
              {fmt(summary.remainingGiven, currency)} left
            </Text>
          </View>

          <View style={[styles.summaryCard, { borderTopWidth: 3, borderTopColor: COLORS.success }]}>
            <View style={[styles.summaryIcon, { backgroundColor: COLORS.success + '22' }]}>
              <ArrowDownLeft color={COLORS.success} size={18} />
            </View>
            <Text style={styles.summaryLabel}>Received</Text>
            <Text style={[styles.summaryAmount, { color: COLORS.success }]}>
              {fmt(summary.totalReceived, currency)}
            </Text>
            <Text style={[styles.summaryLabel, { marginTop: 4 }]}>
              {fmt(summary.remainingReceived, currency)} owed
            </Text>
          </View>

          <View style={[styles.summaryCard, { borderTopWidth: 3, borderTopColor: COLORS.primary }]}>
            <View style={[styles.summaryIcon, { backgroundColor: COLORS.primary + '22' }]}>
              <Wallet color={COLORS.primary} size={18} />
            </View>
            <Text style={styles.summaryLabel}>Net Balance</Text>
            <Text style={[styles.summaryAmount, {
              color: summary.remainingGiven >= summary.remainingReceived ? COLORS.success : COLORS.error,
            }]}>
              {fmt(Math.abs(summary.remainingGiven - summary.remainingReceived), currency)}
            </Text>
            <Text style={[styles.summaryLabel, { marginTop: 4 }]}>
              {summary.remainingGiven >= summary.remainingReceived ? 'in your favour' : 'you owe more'}
            </Text>
          </View>
        </View>

        {/* ── Status tabs (Active / Archive) ── */}
        <View style={styles.statusTabRow}>
          {[
            { key: 'active', label: `Active (${activeCount})` },
            { key: 'archive', label: `Archive (${archiveCount})` },
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.statusTab, statusTab === t.key && styles.statusTabActive]}
              onPress={() => { setStatusTab(t.key); setTab('all'); setExpanded(null); }}
            >
              <Text style={[styles.statusTabText, statusTab === t.key && styles.statusTabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Type tabs (All / Given / Received) ── */}
        <View style={styles.tabRow}>
          {[
            { key: 'all', label: `All (${filteredLoans.length})` },
            { key: 'given', label: `Given (${filteredLoans.filter(l => l.type === GIVEN).length})` },
            { key: 'received', label: `Received (${filteredLoans.filter(l => l.type === RECEIVED).length})` },
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Loan list ── */}
        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
        ) : filteredLoans.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Wallet color={COLORS.textSecondary} size={36} />
            </View>
            <Text style={styles.emptyTitle}>
              {statusTab === 'active' ? 'No Active Loans' : 'No Archived Loans'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {statusTab === 'active'
                ? 'Tap + to record a loan you gave or received.'
                : 'Loans that are fully settled will appear here.'}
            </Text>
          </View>
        ) : (
          filteredLoans.map(loan => {
            const color = typeColor(loan.type);
            const barClr = pctColor(loan.pct);
            const isOpen = expanded === loan.id;

            return (
              <View key={loan.id} style={[styles.loanCard, loan.is_settled && styles.loanCardSettled]}>

                {/* Card header */}
                <View style={styles.loanCardHeader}>
                  <View style={[styles.loanAvatar, { backgroundColor: color + '22' }]}>
                    <Text style={[styles.loanAvatarText, { color }]}>{initials(loan.person_name)}</Text>
                  </View>

                  <View style={styles.loanInfo}>
                    <View style={styles.loanPersonRow}>
                      <Text style={styles.loanPersonName} numberOfLines={1}>{loan.person_name}</Text>

                      {loan.is_settled ? (
                        <View style={styles.settledBadge}>
                          <Text style={styles.settledBadgeText}>Settled</Text>
                        </View>
                      ) : (
                        <View style={[styles.typeBadge, { backgroundColor: color + '22' }]}>
                          <Text style={[styles.typeBadgeText, { color }]}>
                            {loan.type === GIVEN ? '↑ Given' : '↓ Received'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.loanDate}>
                      <Calendar size={11} color={COLORS.textSecondary} /> {fmtDate(loan.date)}
                    </Text>
                  </View>

                  <View style={styles.loanActions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => setExpanded(isOpen ? null : loan.id)}
                    >
                      {isOpen
                        ? <ChevronUp color={COLORS.textSecondary} size={18} />
                        : <ChevronDown color={COLORS.textSecondary} size={18} />}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openAddLoan(loan)}>
                      <Pencil color={COLORS.textSecondary} size={16} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteLoan(loan)}>
                      <Trash2 color={COLORS.error} size={16} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Amounts row */}
                <View style={styles.amountsRow}>
                  <View style={styles.amountBlock}>
                    <Text style={styles.amountLabel}>Total Amount</Text>
                    <Text style={[styles.amountValue, { color }]}>{fmt(loan.total_amount, currency)}</Text>
                  </View>
                  <View style={styles.amountBlock}>
                    <Text style={styles.amountLabel}>Paid Back</Text>
                    <Text style={[styles.amountValue, { color: COLORS.success }]}>{fmt(loan.paid_amount, currency)}</Text>
                  </View>
                  <View style={styles.amountBlock}>
                    <Text style={styles.amountLabel}>Remaining</Text>
                    <Text style={[styles.amountValue, { color: loan.remaining > 0 ? COLORS.warning : COLORS.success }]}>
                      {fmt(loan.remaining, currency)}
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                <ProgressBar
                  paid={loan.paid_amount}
                  total={parseFloat(loan.total_amount)}
                  color={barClr}
                  styles={styles}
                  COLORS={COLORS}
                />

                {/* Next due & remaining installments */}
                {loan.is_multi_installment && !loan.is_settled && loan.remaining_installments > 0 && (
                  <View style={styles.installmentInfoRow}>
                    <View style={styles.installmentInfoBlock}>
                      <Text style={styles.installmentInfoLabel}>Remaining Inst.</Text>
                      <Text style={styles.installmentInfoValue}>
                        {loan.remaining_installments}
                      </Text>
                    </View>
                    <View style={styles.installmentInfoBlock}>
                      <Text style={styles.installmentInfoLabel}>Next Due</Text>
                      <Text style={[styles.installmentInfoValue, loan.isOverdue && { color: COLORS.error }]}>
                        {loan.next_due_date ? fmtDate(loan.next_due_date) : '—'}
                        {loan.isOverdue ? ' ⚠️' : ''}
                      </Text>
                    </View>
                    {loan.installment_amount > 0 && (
                      <View style={styles.installmentInfoBlock}>
                        <Text style={styles.installmentInfoLabel}>Per Inst.</Text>
                        <Text style={styles.installmentInfoValue}>{fmt(loan.installment_amount, currency)}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Notes */}
                {loan.notes ? (
                  <Text style={[styles.paymentItemDate, { marginTop: 8 }]}>📝 {loan.notes}</Text>
                ) : null}

                {/* Add payment / settle / reactivate buttons */}
                {loan.is_settled ? (
                  <TouchableOpacity
                    style={styles.reactivateBtn}
                    onPress={() => handleMarkSettled(loan)}
                  >
                    <RefreshCw color={COLORS.warning} size={15} />
                    <Text style={styles.reactivateBtnText}>Reactivate Loan</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity
                      style={[styles.addPaymentBtn, { flex: 1, borderColor: barClr + '60', backgroundColor: barClr + '12' }]}
                      onPress={() => openAddPayment(loan)}
                    >
                      <Plus color={barClr} size={15} />
                      <Text style={[styles.addPaymentText, { color: barClr }]}>Record Payment</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { width: 40, height: 40, backgroundColor: COLORS.success + '18' }]}
                      onPress={() => handleMarkSettled(loan)}
                    >
                      <CheckCircle color={COLORS.success} size={18} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Expandable payment history */}
                {isOpen && (
                  <View>
                    <View style={styles.paymentHistoryHeader}>
                      <History color={COLORS.textSecondary} size={14} />
                      <Text style={styles.paymentHistoryTitle}>
                        Payment History ({loan.loan_payments.length})
                      </Text>
                    </View>

                    {loan.loan_payments.filter(p => p.is_paid).length === 0 ? (
                      <Text style={[styles.paymentItemDate, { textAlign: 'center', paddingVertical: 8 }]}>
                        No payments recorded yet.
                      </Text>
                    ) : (
                      loan.loan_payments.filter(p => p.is_paid).map(pay => (
                        <View key={pay.id} style={styles.paymentItem}>
                          <View style={[styles.paymentDot, { backgroundColor: COLORS.success }]} />
                          <View style={styles.paymentItemInfo}>
                            <Text style={[styles.paymentItemAmount, { color: COLORS.success }]}>
                              + {fmt(pay.amount, currency)}
                            </Text>
                            <Text style={styles.paymentItemDate}>
                              {fmtDate(pay.date || pay.due_date)}{pay.notes ? `  ·  ${pay.notes}` : ''}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.paymentDeleteBtn, { marginRight: 4 }]}
                            onPress={() => openEditPayment(loan, pay)}
                          >
                            <Pencil color={COLORS.textSecondary} size={14} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.paymentDeleteBtn}
                            onPress={() => handleDeletePayment(pay.id, loan)}
                          >
                            <Trash2 color={COLORS.error} size={14} />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}

                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 24 }]} onPress={() => openAddLoan()}>
        <Plus color="#fff" size={26} />
      </TouchableOpacity>

      {/* ════════════════════════════════════
          ADD / EDIT LOAN MODAL
      ════════════════════════════════════ */}
      <Modal
        visible={showAddLoan}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddLoan(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingLoan ? 'Edit Loan' : 'New Loan'}
              </Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowAddLoan(false)}>
                <X color={COLORS.text} size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">

              {/* Type selector */}
              <Text style={styles.fieldLabel}>Loan Type</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    loanType === GIVEN && { ...styles.typeBtnActive, backgroundColor: COLORS.error + '18', borderColor: COLORS.error },
                  ]}
                  onPress={() => setLoanType(GIVEN)}
                >
                  <ArrowUpRight color={loanType === GIVEN ? COLORS.error : COLORS.textSecondary} size={20} />
                  <Text style={[styles.typeBtnLabel, { color: loanType === GIVEN ? COLORS.error : COLORS.textSecondary }]}>
                    I Gave
                  </Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>Money out</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    loanType === RECEIVED && { ...styles.typeBtnActive, backgroundColor: COLORS.success + '18', borderColor: COLORS.success },
                  ]}
                  onPress={() => setLoanType(RECEIVED)}
                >
                  <ArrowDownLeft color={loanType === RECEIVED ? COLORS.success : COLORS.textSecondary} size={20} />
                  <Text style={[styles.typeBtnLabel, { color: loanType === RECEIVED ? COLORS.success : COLORS.textSecondary }]}>
                    I Received
                  </Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>Money in</Text>
                </TouchableOpacity>
              </View>

              {/* Person name */}
              <Text style={styles.fieldLabel}>
                {loanType === GIVEN ? 'Given To' : 'Received From'}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="Person / Company Name"
                placeholderTextColor={COLORS.textSecondary}
                value={personName}
                onChangeText={setPersonName}
              />

              {/* Amount */}
              <Text style={styles.fieldLabel}>Loan Amount ({currency})</Text>
              <TextInput
                style={styles.textInput}
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
                value={loanAmount}
                onChangeText={setLoanAmount}
              />

              {/* Date */}
              <Text style={styles.fieldLabel}>Date</Text>
              <TouchableOpacity
                style={styles.dateBtn}
                onPress={() => setShowLoanDate(true)}
              >
                <Calendar color={COLORS.primary} size={18} />
                <Text style={styles.dateBtnText}>{fmtDate(loanDate)}</Text>
              </TouchableOpacity>

              {showLoanDate && (
                <DateTimePicker
                  value={loanDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  textColor={COLORS.text}
                  onChange={(e, d) => { setShowLoanDate(Platform.OS === 'ios'); if (d) setLoanDate(d); }}
                />
              )}

              {/* Due Date */}
              <Text style={styles.fieldLabel}>Due Date (optional)</Text>
              <TouchableOpacity
                style={styles.dateBtn}
                onPress={() => setShowLoanDueDate(true)}
              >
                <Calendar color={COLORS.primary} size={18} />
                <Text style={styles.dateBtnText}>{fmtDate(loanDueDate)}</Text>
              </TouchableOpacity>

              {showLoanDueDate && (
                <DateTimePicker
                  value={loanDueDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  textColor={COLORS.text}
                  onChange={(e, d) => { setShowLoanDueDate(Platform.OS === 'ios'); if (d) setLoanDueDate(d); }}
                />
              )}

              {/* Account Selection */}
              <Text style={styles.fieldLabel}>Account (optional)</Text>
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 60 }}>
                  <TouchableOpacity
                    style={[
                      { paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.divider },
                      !selectedAccount && { backgroundColor: COLORS.primary + '22' }
                    ]}
                    onPress={() => setSelectedAccount(null)}
                  >
                    <Text style={{ color: !selectedAccount ? COLORS.primary : COLORS.textSecondary, fontWeight: '600', fontSize: 12 }}>
                      None
                    </Text>
                  </TouchableOpacity>
                  {accounts.map(acct => (
                    <TouchableOpacity
                      key={acct.id}
                      style={[
                        { paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.divider },
                        selectedAccount?.id === acct.id && { backgroundColor: acct.color + '22' }
                      ]}
                      onPress={() => setSelectedAccount(acct)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View>
                          <Text style={{ color: selectedAccount?.id === acct.id ? acct.color : COLORS.textSecondary, fontWeight: '600', fontSize: 12 }}>
                            {acct.account_name}
                          </Text>
                          {acct.bank_name ? (
                            <Text style={{ color: COLORS.textSecondary, fontSize: 9, opacity: 0.7 }}>
                              {acct.bank_name}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Repayment Type */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Repayment Type</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    repaymentType === 'single' && { ...styles.typeBtnActive, backgroundColor: COLORS.primary + '18', borderColor: COLORS.primary },
                  ]}
                  onPress={() => setRepaymentType('single')}
                >
                  <Text style={[styles.typeBtnLabel, { color: repaymentType === 'single' ? COLORS.primary : COLORS.textSecondary }]}>
                    Single Payment
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    repaymentType === 'multi' && { ...styles.typeBtnActive, backgroundColor: COLORS.primary + '18', borderColor: COLORS.primary },
                  ]}
                  onPress={() => setRepaymentType('multi')}
                >
                  <Text style={[styles.typeBtnLabel, { color: repaymentType === 'multi' ? COLORS.primary : COLORS.textSecondary }]}>
                    Installments
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Multi-installment fields */}
              {repaymentType === 'multi' && (
                <>
                  {/* Define by toggle */}
                  <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Define By</Text>
                  <View style={styles.typeRow}>
                    <TouchableOpacity
                      style={[
                        styles.typeBtn,
                        defineBy === 'count' && { ...styles.typeBtnActive, backgroundColor: COLORS.primary + '18', borderColor: COLORS.primary },
                      ]}
                      onPress={() => setDefineBy('count')}
                    >
                      <Text style={[styles.typeBtnLabel, { color: defineBy === 'count' ? COLORS.primary : COLORS.textSecondary }]}>
                        Number of Installments
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeBtn,
                        defineBy === 'amount' && { ...styles.typeBtnActive, backgroundColor: COLORS.primary + '18', borderColor: COLORS.primary },
                      ]}
                      onPress={() => setDefineBy('amount')}
                    >
                      <Text style={[styles.typeBtnLabel, { color: defineBy === 'amount' ? COLORS.primary : COLORS.textSecondary }]}>
                        Installment Amount
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {defineBy === 'count' ? (
                    <>
                      <Text style={styles.fieldLabel}>Number of Installments</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. 12"
                        placeholderTextColor={COLORS.textSecondary}
                        keyboardType="number-pad"
                        value={numInstallments}
                        onChangeText={setNumInstallments}
                      />
                      {calculatedInstallmentAmount !== null && (
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Each installment:</Text>
                          <Text style={styles.calcValue}>{fmt(calculatedInstallmentAmount, currency)}</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={styles.fieldLabel}>Installment Amount ({currency})</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. 5000"
                        placeholderTextColor={COLORS.textSecondary}
                        keyboardType="decimal-pad"
                        value={installmentAmount}
                        onChangeText={setInstallmentAmount}
                      />
                      {calculatedInstallmentCount !== null && (
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Total installments:</Text>
                          <Text style={styles.calcValue}>{calculatedInstallmentCount}</Text>
                        </View>
                      )}
                    </>
                  )}

                  <Text style={styles.fieldLabel}>Installment Interval</Text>
                  <View style={{ borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' }}>
                    {['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'].map(interval => (
                      <TouchableOpacity
                        key={interval}
                        style={[
                          { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
                          installmentInterval === interval && { backgroundColor: COLORS.primary + '22' }
                        ]}
                        onPress={() => setInstallmentInterval(interval)}
                      >
                        <Text style={{ color: installmentInterval === interval ? COLORS.primary : COLORS.text, fontWeight: '600', textTransform: 'capitalize' }}>
                          {interval.charAt(0).toUpperCase() + interval.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Notes */}
              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Any additional details..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                value={loanNotes}
                onChangeText={setLoanNotes}
              />

              {/* Save button */}
              <TouchableOpacity
                style={[styles.saveBtn, {
                  backgroundColor: loanType === GIVEN ? COLORS.error : COLORS.success,
                  opacity: savingLoan ? 0.7 : 1,
                }]}
                onPress={handleSaveLoan}
                disabled={savingLoan}
              >
                {savingLoan
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>
                    {editingLoan ? 'Update Loan' : `Record ${loanType === GIVEN ? 'Given' : 'Received'} Loan`}
                  </Text>
                }
              </TouchableOpacity>
              <View style={{ height: insets.bottom + 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════════════════════════════════════
          ADD PAYMENT MODAL
      ════════════════════════════════════ */}
      <Modal
        visible={showAddPayment}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowAddPayment(false); setEditingPaymentItem(null); }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalSheet, { maxHeight: '70%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingPaymentItem ? 'Edit Payment' : 'Record Payment'}</Text>
                <Text style={[styles.paymentItemDate, { marginTop: 2 }]}>
                  {paymentLoan?.person_name}  ·  {fmt(paymentLoan?.remaining, currency)} remaining
                </Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setShowAddPayment(false); setEditingPaymentItem(null); }}>
                <X color={COLORS.text} size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">

              <Text style={styles.fieldLabel}>Amount ({currency})</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { fontSize: 22, fontWeight: '800', textAlign: 'center' },
                  paymentAmount && parseFloat(paymentAmount) > paymentLoan?.remaining && { borderColor: COLORS.error, borderWidth: 2 },
                ]}
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                autoFocus
              />

              {/* Runtime balance preview */}
              {paymentAmount && parseFloat(paymentAmount) > 0 && (
                <View style={[styles.calcRow, {
                  backgroundColor: parseFloat(paymentAmount) > paymentLoan?.remaining
                    ? COLORS.error + '18'
                    : COLORS.success + '18',
                  borderColor: parseFloat(paymentAmount) > paymentLoan?.remaining
                    ? COLORS.error + '40'
                    : COLORS.success + '40',
                }]}>
                  <Text style={styles.calcLabel}>
                    {parseFloat(paymentAmount) > paymentLoan?.remaining
                      ? 'Exceeds balance by'
                      : 'After payment'}
                  </Text>
                  <Text style={[styles.calcValue, {
                    color: parseFloat(paymentAmount) > paymentLoan?.remaining
                      ? COLORS.error
                      : COLORS.success,
                  }]}>
                    {parseFloat(paymentAmount) > paymentLoan?.remaining
                      ? fmt(parseFloat(paymentAmount) - paymentLoan?.remaining, currency)
                      : fmt(paymentLoan?.remaining - parseFloat(paymentAmount), currency)}
                  </Text>
                </View>
              )}

              {/* Account selector (only for new payments, not edit) */}
              {!editingPaymentItem && (
                <>
                  <Text style={styles.fieldLabel}>Receive in Account</Text>
                  <View style={{ borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 4 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 60 }}>
                      <TouchableOpacity
                        style={[
                          { paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.divider },
                          !paymentAccount && { backgroundColor: COLORS.primary + '22' }
                        ]}
                        onPress={() => setPaymentAccount(null)}
                      >
                        <Text style={{ color: !paymentAccount ? COLORS.primary : COLORS.textSecondary, fontWeight: '600', fontSize: 12 }}>
                          {paymentLoan?.account_id ? 'Same as loan' : 'None'}
                        </Text>
                      </TouchableOpacity>
                      {accounts.map(acct => (
                        <TouchableOpacity
                          key={acct.id}
                          style={[
                            { paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.divider },
                            paymentAccount?.id === acct.id && { backgroundColor: acct.color + '22' }
                          ]}
                          onPress={() => setPaymentAccount(acct)}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View>
                              <Text style={{ color: paymentAccount?.id === acct.id ? acct.color : COLORS.textSecondary, fontWeight: '600', fontSize: 12 }}>
                                {acct.account_name}
                              </Text>
                              {acct.bank_name ? (
                                <Text style={{ color: COLORS.textSecondary, fontSize: 9, opacity: 0.7 }}>
                                  {acct.bank_name}
                                </Text>
                              ) : null}
                            </View>
                            {defaultPaymentAccountId === acct.id && (
                              <Text style={{ color: COLORS.warning, fontSize: 10 }}>★</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Set as default toggle */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                      marginBottom: 16, paddingVertical: 8,
                    }}
                    onPress={() => {
                      if (defaultPaymentAccountId === paymentAccount?.id) {
                        setDefaultPaymentAccountId(null);
                        loanService.setDefaultPaymentAccount(userId, null);
                      } else if (paymentAccount) {
                        setDefaultPaymentAccountId(paymentAccount.id);
                        loanService.setDefaultPaymentAccount(userId, paymentAccount);
                      }
                    }}
                  >
                    <View style={{
                      width: 20, height: 20, borderRadius: 4,
                      borderWidth: 2,
                      borderColor: defaultPaymentAccountId === paymentAccount?.id ? COLORS.warning : COLORS.border,
                      backgroundColor: defaultPaymentAccountId === paymentAccount?.id ? COLORS.warning + '22' : 'transparent',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {defaultPaymentAccountId === paymentAccount?.id && (
                        <Text style={{ color: COLORS.warning, fontSize: 12, fontWeight: '800' }}>✓</Text>
                      )}
                    </View>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' }}>
                      Default account for repayments
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <Text style={styles.fieldLabel}>Date</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPayDate(true)}>
                <Calendar color={COLORS.primary} size={18} />
                <Text style={styles.dateBtnText}>{fmtDate(paymentDate)}</Text>
              </TouchableOpacity>

              {showPayDate && (
                <DateTimePicker
                  value={paymentDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  textColor={COLORS.text}
                  onChange={(e, d) => { setShowPayDate(Platform.OS === 'ios'); if (d) setPaymentDate(d); }}
                />
              )}

              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Cash, Bank Transfer..."
                placeholderTextColor={COLORS.textSecondary}
                value={paymentNotes}
                onChangeText={setPaymentNotes}
              />

              <TouchableOpacity
                style={[styles.saveBtn, {
                  backgroundColor: parseFloat(paymentAmount) > paymentLoan?.remaining ? COLORS.textSecondary : COLORS.success,
                  opacity: savingPayment ? 0.7 : 1,
                }]}
                onPress={handleSavePayment}
                disabled={savingPayment || parseFloat(paymentAmount) > paymentLoan?.remaining}
              >
                {savingPayment
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>
                    {parseFloat(paymentAmount) > paymentLoan?.remaining
                      ? 'Insufficient Balance'
                      : (editingPaymentItem ? 'Update Payment' : 'Save Payment')
                    }
                  </Text>
                }
              </TouchableOpacity>
              <View style={{ height: insets.bottom + 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
};

export default LoanManagement;
