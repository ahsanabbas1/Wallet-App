import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Modal, Platform,
  KeyboardAvoidingView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Menu, Plus, X, Calendar, TrendingUp, TrendingDown,
  Wallet, Pencil, Trash2, ChevronDown, ChevronUp,
  CheckCircle, History, ArrowDownLeft, ArrowUpRight, RefreshCw,
} from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth }   from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useTheme }  from '../../context/ThemeContext';
import { supabase }  from '../../lib/supabase';
import { makeStyles } from './styles';

/* ─── helpers ────────────────────────────────────────────────────────── */

const fmt  = (n, cur) => `${cur} ${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const initials = (name) => (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate  = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const GIVEN    = 'given';
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
  const { openDrawer }          = useDrawer();
  const { userId }              = useAuth();
  const { currency }            = useProfile();
  const { colors: COLORS }      = useTheme();
  const styles                  = useMemo(() => makeStyles(COLORS), [COLORS]);

  /* ── Data ───────────────────────────────────────────────────────── */
  const [loans,   setLoans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('all'); // all | given | received
  const [expanded, setExpanded] = useState(null); // expanded loan id

  /* ── Add-loan modal ─────────────────────────────────────────────── */
  const [showAddLoan,    setShowAddLoan]    = useState(false);
  const [editingLoan,    setEditingLoan]    = useState(null);
  const [loanType,       setLoanType]       = useState(GIVEN);
  const [personName,     setPersonName]     = useState('');
  const [loanAmount,     setLoanAmount]     = useState('');
  const [loanDate,       setLoanDate]       = useState(new Date());
  const [loanNotes,      setLoanNotes]      = useState('');
  const [showLoanDate,   setShowLoanDate]   = useState(false);
  const [savingLoan,     setSavingLoan]     = useState(false);

  /* ── Add-payment modal ──────────────────────────────────────────── */
  const [showAddPayment,  setShowAddPayment]  = useState(false);
  const [paymentLoan,     setPaymentLoan]     = useState(null);
  const [paymentAmount,   setPaymentAmount]   = useState('');
  const [paymentDate,     setPaymentDate]     = useState(new Date());
  const [paymentNotes,    setPaymentNotes]    = useState('');
  const [showPayDate,     setShowPayDate]     = useState(false);
  const [savingPayment,   setSavingPayment]   = useState(false);

  /* ── Fetch ──────────────────────────────────────────────────────── */
  const fetchLoans = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loans')
        .select('*, loan_payments(*)')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      if (error) throw error;

      // attach computed fields
      const enriched = (data || []).map(loan => {
        const paid = (loan.loan_payments || [])
          .reduce((s, p) => s + parseFloat(p.amount), 0);
        const remaining = parseFloat(loan.total_amount) - paid;
        return {
          ...loan,
          paid_amount: paid,
          remaining: Math.max(remaining, 0),
          pct: loan.total_amount > 0 ? Math.min((paid / parseFloat(loan.total_amount)) * 100, 100) : 0,
          loan_payments: (loan.loan_payments || [])
            .sort((a, b) => new Date(b.date) - new Date(a.date)),
        };
      });
      setLoans(enriched);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchLoans(); }, [userId]));

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`loans_rt_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans',         filter: `user_id=eq.${userId}` }, () => fetchLoans())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_payments'                                 }, () => fetchLoans())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]);

  /* ── Summary figures ────────────────────────────────────────────── */
  const summary = useMemo(() => {
    const given    = loans.filter(l => l.type === GIVEN);
    const received = loans.filter(l => l.type === RECEIVED);
    return {
      totalGiven:         given.reduce   ((s, l) => s + parseFloat(l.total_amount), 0),
      totalReceived:      received.reduce((s, l) => s + parseFloat(l.total_amount), 0),
      remainingGiven:     given.reduce   ((s, l) => s + l.remaining, 0),
      remainingReceived:  received.reduce((s, l) => s + l.remaining, 0),
    };
  }, [loans]);

  /* ── Filtered list ──────────────────────────────────────────────── */
  const filteredLoans = useMemo(() => {
    if (tab === 'all') return loans;
    return loans.filter(l => l.type === tab);
  }, [loans, tab]);

  /* ══ LOAN CRUD ══════════════════════════════════════════════════════ */

  const openAddLoan = (loan = null) => {
    setEditingLoan(loan);
    setLoanType   (loan?.type        || GIVEN);
    setPersonName (loan?.person_name || '');
    setLoanAmount (loan ? String(loan.total_amount) : '');
    setLoanDate   (loan ? new Date(loan.date) : new Date());
    setLoanNotes  (loan?.notes || '');
    setShowAddLoan(true);
  };

  const handleSaveLoan = async () => {
    if (!personName.trim())         return Alert.alert('Missing', 'Enter the person\'s name.');
    const amt = parseFloat(loanAmount);
    if (!amt || amt <= 0)           return Alert.alert('Invalid', 'Enter a valid loan amount.');

    setSavingLoan(true);
    try {
      const payload = {
        user_id:      userId,
        type:         loanType,
        person_name:  personName.trim(),
        total_amount: amt,
        date:         loanDate.toISOString(),
        notes:        loanNotes.trim() || null,
      };

      if (editingLoan) {
        const { error } = await supabase.from('loans').update(payload).eq('id', editingLoan.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from('loans').insert(payload).select().single();
        if (error) throw error;

        // Auto-create ledger transaction
        const isGiven   = loanType === GIVEN;
        const txTitle   = isGiven
          ? `Loan to ${personName.trim()}`
          : `Loan from ${personName.trim()}`;
        await supabase.from('transactions').insert({
          user_id:     userId,
          amount:      amt,
          type:        isGiven ? 'expense' : 'income',
          title:       txTitle,
          description: `Loan ID: ${inserted.id}`,
          date:        loanDate.toISOString(),
        });
      }

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
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('loans').delete().eq('id', loan.id);
          if (error) Alert.alert('Error', error.message);
          else fetchLoans();
        }},
      ]
    );
  };

  const handleMarkSettled = async (loan) => {
    const { error } = await supabase
      .from('loans')
      .update({ is_settled: !loan.is_settled })
      .eq('id', loan.id);
    if (error) Alert.alert('Error', error.message);
    else fetchLoans();
  };

  /* ══ PAYMENT CRUD ═══════════════════════════════════════════════════ */

  const openAddPayment = (loan) => {
    setPaymentLoan  (loan);
    setPaymentAmount('');
    setPaymentDate  (new Date());
    setPaymentNotes ('');
    setShowAddPayment(true);
  };

  const handleSavePayment = async () => {
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) return Alert.alert('Invalid', 'Enter a valid payment amount.');
    if (amt > paymentLoan.remaining + 0.01)
      return Alert.alert('Exceeds Balance', `Remaining balance is ${fmt(paymentLoan.remaining, currency)}.`);

    setSavingPayment(true);
    try {
      const { error } = await supabase.from('loan_payments').insert({
        loan_id: paymentLoan.id,
        amount:  amt,
        date:    paymentDate.toISOString(),
        notes:   paymentNotes.trim() || null,
      });
      if (error) throw error;

      // Auto-settle if fully paid
      const newPaid = paymentLoan.paid_amount + amt;
      if (newPaid >= parseFloat(paymentLoan.total_amount)) {
        await supabase.from('loans').update({ is_settled: true }).eq('id', paymentLoan.id);
        Alert.alert('🎉 Fully Settled!', `The loan with ${paymentLoan.person_name} is now fully settled.`);
      }

      // Ledger entry for payment
      const isGiven = paymentLoan.type === GIVEN;
      await supabase.from('transactions').insert({
        user_id:     userId,
        amount:      amt,
        type:        isGiven ? 'income' : 'expense',
        title:       isGiven
          ? `Loan repaid by ${paymentLoan.person_name}`
          : `Loan repaid to ${paymentLoan.person_name}`,
        description: `Loan payment`,
        date:        paymentDate.toISOString(),
      });

      setShowAddPayment(false);
      fetchLoans();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = (paymentId) => {
    Alert.alert('Delete Payment', 'Remove this payment record?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('loan_payments').delete().eq('id', paymentId);
        if (error) Alert.alert('Error', error.message);
        else fetchLoans();
      }},
    ]);
  };

  /* ── Color helpers ──────────────────────────────────────────────── */
  const typeColor = (type) => type === GIVEN ? COLORS.error : COLORS.success;
  const pctColor  = (pct)  => pct >= 100 ? COLORS.success : pct >= 60 ? COLORS.warning : COLORS.primary;

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
        <TouchableOpacity style={styles.headerBtn} onPress={fetchLoans}>
          <RefreshCw color={COLORS.textSecondary} size={18} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.headerBtn, { backgroundColor: COLORS.primary + '22' }]} onPress={() => openAddLoan()}>
          <Plus color={COLORS.primary} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
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

        {/* ── Tabs ── */}
        <View style={styles.tabRow}>
          {[
            { key: 'all',      label: `All (${loans.length})` },
            { key: 'given',    label: `Given (${loans.filter(l => l.type === GIVEN).length})` },
            { key: 'received', label: `Received (${loans.filter(l => l.type === RECEIVED).length})` },
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
            <Text style={styles.emptyTitle}>No Loans Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap + to record a loan you gave or received.
            </Text>
          </View>
        ) : (
          filteredLoans.map(loan => {
            const color  = typeColor(loan.type);
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
                        ? <ChevronUp   color={COLORS.textSecondary} size={18} />
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

                {/* Notes */}
                {loan.notes ? (
                  <Text style={[styles.paymentItemDate, { marginTop: 8 }]}>📝 {loan.notes}</Text>
                ) : null}

                {/* Add payment / settle buttons */}
                {!loan.is_settled && (
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

                    {loan.loan_payments.length === 0 ? (
                      <Text style={[styles.paymentItemDate, { textAlign: 'center', paddingVertical: 8 }]}>
                        No payments recorded yet.
                      </Text>
                    ) : (
                      loan.loan_payments.map(pay => (
                        <View key={pay.id} style={styles.paymentItem}>
                          <View style={[styles.paymentDot, { backgroundColor: COLORS.success }]} />
                          <View style={styles.paymentItemInfo}>
                            <Text style={[styles.paymentItemAmount, { color: COLORS.success }]}>
                              + {fmt(pay.amount, currency)}
                            </Text>
                            <Text style={styles.paymentItemDate}>
                              {fmtDate(pay.date)}{pay.notes ? `  ·  ${pay.notes}` : ''}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.paymentDeleteBtn}
                            onPress={() => handleDeletePayment(pay.id)}
                          >
                            <Trash2 color={COLORS.error} size={14} />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}

                    {loan.is_settled && (
                      <TouchableOpacity
                        style={{ marginTop: 8, alignSelf: 'flex-end' }}
                        onPress={() => handleMarkSettled(loan)}
                      >
                        <Text style={{ color: COLORS.warning, fontSize: 12, fontWeight: '600' }}>
                          Mark as Active
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity style={styles.fab} onPress={() => openAddLoan()}>
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
        onRequestClose={() => setShowAddPayment(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalSheet, { maxHeight: '70%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Record Payment</Text>
                <Text style={[styles.paymentItemDate, { marginTop: 2 }]}>
                  {paymentLoan?.person_name}  ·  {fmt(paymentLoan?.remaining, currency)} remaining
                </Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowAddPayment(false)}>
                <X color={COLORS.text} size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">

              <Text style={styles.fieldLabel}>Amount ({currency})</Text>
              <TextInput
                style={[styles.textInput, { fontSize: 22, fontWeight: '800', textAlign: 'center' }]}
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                autoFocus
              />

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
                style={[styles.saveBtn, { backgroundColor: COLORS.success, opacity: savingPayment ? 0.7 : 1 }]}
                onPress={handleSavePayment}
                disabled={savingPayment}
              >
                {savingPayment
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>Save Payment</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
};

export default LoanManagement;
