import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Modal, KeyboardAvoidingView,
  Platform, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Icons from 'lucide-react-native';
import {
  Menu, Plus, X, Pencil, Trash2, Wallet, Info,
  Building2, CreditCard, Smartphone, Coins, PiggyBank,
} from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useTheme } from '../../context/ThemeContext';
import { SIZES } from '../../constants/theme';
import { makeStyles } from './styles';
import { accountService } from '../../services/accountService';
import HeaderPlusButton from '../../components/HeaderPlusButton';

/* ─── constants ────────────────────────────────────────────────────────── */

const ACCOUNT_TYPES = [
  { key: 'savings', label: 'Savings' },
  { key: 'current', label: 'Current' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'cash', label: 'Cash' },
  { key: 'credit', label: 'Credit' },
];

const PRESET_COLORS = [
  '#4f5ff7', '#22c55e', '#ef4444', '#f97316',
  '#8B5CF6', '#0EA5E9', '#EC4899', '#14B8A6',
];

const ICON_OPTIONS = [
  { key: 'Wallet', Icon: Wallet },
  { key: 'Building2', Icon: Building2 },
  { key: 'CreditCard', Icon: CreditCard },
  { key: 'Smartphone', Icon: Smartphone },
  { key: 'Coins', Icon: Coins },
  { key: 'PiggyBank', Icon: PiggyBank },
];

const fmt = (n, cur) =>
  `${cur} ${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/* ════════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
════════════════════════════════════════════════════════════════════════════ */

const Accounts = () => {
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const { currency } = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();

  /* ── data ──────────────────────────────────────────────────────────── */
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── modal state ────────────────────────────────────────────────────── */
  const [showModal, setShowModal] = useState(false);
  const [editingAcct, setEditingAcct] = useState(null);
  const [bankName, setBankName] = useState('');
  const [acctName, setAcctName] = useState('');
  const [acctType, setAcctType] = useState('savings');
  const [balance, setBalance] = useState('');
  const [acctColor, setAcctColor] = useState(PRESET_COLORS[0]);
  const [acctIcon, setAcctIcon] = useState('Wallet');
  const [saving, setSaving] = useState(false);
  /* ── details tab state ──────────────────────────────────────────── */
  const [detailsTab, setDetailsTab] = useState('accounts'); // 'accounts' | 'details'
  const [detailsAccountId, setDetailsAccountId] = useState(null); // null = All
  const [detailsPeriod, setDetailsPeriod] = useState('ALL'); // 1W,1M,3M,6M,1Y,ALL
  const [detailsData, setDetailsData] = useState({ transactions: [], spent: 0, received: 0, count: 0 });
  const [detailsLoading, setDetailsLoading] = useState(false);

  /* ── transfer modal state ───────────────────────────────────────── */
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferFrom, setTransferFrom] = useState(null);
  const [transferTo, setTransferTo] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferring, setTransferring] = useState(false);
  /* ── projected balances for transfer preview ──────────────────── */
  const projectedFromBalance = useMemo(() => {
    if (!transferFrom || !transferAmount) return null;
    return Number(transferFrom.balance) - (parseFloat(transferAmount) || 0);
  }, [transferFrom, transferAmount]);
  const insufficientBalance = useMemo(() => {
    if (!transferFrom || !transferAmount) return false;
    return parseFloat(transferAmount) > Number(transferFrom.balance);
  }, [transferFrom, transferAmount]);
  const projectedToBalance = useMemo(() => {
    if (!transferTo || !transferAmount) return null;
    return Number(transferTo.balance) + (parseFloat(transferAmount) || 0);
  }, [transferTo, transferAmount]);
  /* ── fetch ──────────────────────────────────────────────────────────── */
  const fetchAccounts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await accountService.getAccountsWithStats(userId);
      setAccounts(data);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { fetchAccounts(); }, [fetchAccounts]));

  const fetchDetails = useCallback(async (acctId, period) => {
    if (!userId) return;
    setDetailsLoading(true);
    try {
      const data = await accountService.getTransactionsByAccount(userId, acctId, period);
      setDetailsData(data);
    } catch (e) {
      setDetailsData({ transactions: [], spent: 0, received: 0, count: 0 });
    } finally {
      setDetailsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (detailsTab === 'details') fetchDetails(detailsAccountId, detailsPeriod);
  }, [detailsTab, detailsAccountId, detailsPeriod, fetchDetails]);

  const showPageInfo = () => Alert.alert('About This Page', 'Manage your bank accounts and wallets. Track balances, add new accounts, and see monthly activity per account.');

  /* ── computed ───────────────────────────────────────────────────────── */
  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0), [accounts]);
  const totalMonthlySpent = useMemo(() => accounts.reduce((s, a) => s + (Number(a.monthly_spent) || 0), 0), [accounts]);
  const totalMonthlyIn = useMemo(() => accounts.reduce((s, a) => s + (Number(a.monthly_received) || 0), 0), [accounts]);

  /* ── open modal ─────────────────────────────────────────────────────── */
  const openAdd = () => {
    setEditingAcct(null);
    setBankName('');
    setAcctName('');
    setAcctType('savings');
    setBalance('');
    setAcctColor(PRESET_COLORS[0]);
    setAcctIcon('Wallet');
    setShowModal(true);
  };

  const openEdit = (acct) => {
    setEditingAcct(acct);
    setBankName(acct.bank_name || '');
    setAcctName(acct.account_name);
    setAcctType(acct.account_type || 'savings');
    setBalance(String(acct.balance));
    setAcctColor(acct.color || PRESET_COLORS[0]);
    setAcctIcon(acct.icon || 'Wallet');
    setShowModal(true);
  };

  /* ── save ───────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!acctName.trim()) return Alert.alert('Missing', 'Enter an account name.');
    const bal = parseFloat(balance);
    if (isNaN(bal)) return Alert.alert('Invalid', 'Enter a valid balance amount.');

    setSaving(true);
    try {
      await accountService.saveAccount(userId, {
        id: editingAcct?.id,
        bank_name: bankName.trim(),
        account_name: acctName.trim(),
        account_type: acctType,
        balance: bal,
        color: acctColor,
        icon: acctIcon,
      }, !editingAcct);
      setShowModal(false);
      fetchAccounts();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── delete ─────────────────────────────────────────────────────────── */
  const handleDelete = (acct) => {
    Alert.alert(
      'Delete Account',
      `Remove "${acct.account_name}"? Past transactions linked to this account will not be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await accountService.deleteAccount(acct.id);
              fetchAccounts();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          }
        },
      ]
    );
  };

  /* ── transfer ───────────────────────────────────────────────────────── */
  const openTransfer = (fromAcct) => {
    setTransferFrom(fromAcct);
    setTransferTo(null);
    setTransferAmount('');
    setTransferNotes('');
    setShowTransfer(true);
  };

  const handleTransfer = async () => {
    if (!transferFrom || !transferTo) {
      return Alert.alert('Missing', 'Select both accounts.');
    }
    if (transferFrom.id === transferTo.id) {
      return Alert.alert('Invalid', 'Cannot transfer to the same account.');
    }
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) {
      return Alert.alert('Invalid', 'Enter a valid transfer amount.');
    }
    if (transferFrom.balance < amt) {
      return Alert.alert('Insufficient Balance', `Available: ${fmt(transferFrom.balance, currency)}`);
    }

    setTransferring(true);
    try {
      await accountService.transferFunds(userId, transferFrom.id, transferTo.id, amt, transferNotes.trim());
      const newFromBal = Number(transferFrom.balance) - amt;
      const newToBal = Number(transferTo.balance) + amt;
      Alert.alert(
        'Transfer Successful',
        `${fmt(amt, currency)} transferred from ${transferFrom.account_name} to ${transferTo.account_name}\n\n${transferFrom.account_name}: ${fmt(newFromBal, currency)}\n${transferTo.account_name}: ${fmt(newToBal, currency)}`
      );
      setShowTransfer(false);
      fetchAccounts();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setTransferring(false);
    }
  };

  /* ── render icon helper ─────────────────────────────────────────────── */
  const renderIcon = (iconKey, size, color) => {
    const option = ICON_OPTIONS.find(o => o.key === iconKey);
    if (option) return <option.Icon color={color} size={size} />;
    return <Wallet color={color} size={size} />;
  };

  /* ─────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={{ marginRight: 12 }}>
          <Menu color={COLORS.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Accounts</Text>
        <HeaderPlusButton onPress={openAdd} />
        <TouchableOpacity style={styles.headerBtn} onPress={showPageInfo}>
          <Info color={COLORS.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      {/* ── Tab bar (Accounts / Details) ── */}
      <View style={styles.detailsTabRow}>
        {['accounts', 'details'].map(tabKey => (
          <TouchableOpacity
            key={tabKey}
            style={[styles.detailsTab, detailsTab === tabKey && styles.detailsTabActive]}
            onPress={() => setDetailsTab(tabKey)}
          >
            <Text style={[styles.detailsTabText, detailsTab === tabKey && styles.detailsTabTextActive]}>
              {tabKey === 'accounts' ? 'Accounts' : 'Details'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>

        {detailsTab === 'accounts' ? (
          <>
            {/* ── Total balance card ── */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Cash in Hands</Text>
              <Text style={styles.totalAmount}>{fmt(totalBalance, currency)}</Text>
              <Text style={styles.totalSub}>{accounts.length} account{accounts.length !== 1 ? 's' : ''} · This month</Text>

              {accounts.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                  <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>− {fmt(totalMonthlySpent, currency)}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 2 }}>Total Spent</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>+ {fmt(totalMonthlyIn, currency)}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 2 }}>Total Received</Text>
                  </View>
                </View>
              )}
            </View>

            {/* ── Accounts list ── */}
            {accounts.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your Accounts</Text>
              </View>
            )}

            {loading ? (
              <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
            ) : accounts.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Building2 color={COLORS.textSecondary} size={36} />
                </View>
                <Text style={styles.emptyTitle}>No Accounts Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Add your bank accounts, wallets, or cash holdings. The total will show as your Cash in Hands on the Dashboard.
                </Text>
              </View>
            ) : (
              accounts.map(acct => {
                const spent = Number(acct.monthly_spent || 0);
                const received = Number(acct.monthly_received || 0);
                const balance = Number(acct.balance || 0);
                const spendable = balance + spent;
                const spendPct = spendable > 0 ? Math.min((spent / spendable) * 100, 100) : 0;
                const typeLabel = ACCOUNT_TYPES.find(t => t.key === acct.account_type)?.label ?? acct.account_type;

                return (
                  <View key={acct.id} style={[styles.accountCard, { flexDirection: 'column', alignItems: 'stretch', padding: 16 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
                        <View style={[styles.accountIconWrap, { backgroundColor: acct.color + '15', marginRight: 12 }]}>
                          {renderIcon(acct.icon, 20, acct.color)}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.accountName, { fontSize: 16, fontWeight: '700' }]} numberOfLines={1}>{acct.account_name}</Text>
                          {!!acct.bank_name && (
                            <Text style={[styles.accountBank, { fontSize: 12, color: COLORS.textSecondary }]} numberOfLines={1}>{acct.bank_name}</Text>
                          )}
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.accountBalance, { color: acct.color, fontSize: 18, fontWeight: '800', marginRight: 0 }]}>
                          {fmt(balance, currency)}
                        </Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' }}>Monthly Spending</Text>
                        <Text style={{ color: spendPct > 75 ? COLORS.error : spendPct > 50 ? COLORS.warning : COLORS.success, fontSize: 11, fontWeight: '700' }}>
                          {spendPct.toFixed(0)}% spent
                        </Text>
                      </View>
                      <View style={{ height: 4, backgroundColor: COLORS.surface, borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
                        <View style={{
                          height: '100%', borderRadius: 2, width: `${spendPct}%`,
                          backgroundColor: spendPct > 75 ? COLORS.error : spendPct > 50 ? COLORS.warning : acct.color,
                        }} />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1, backgroundColor: COLORS.error + '08', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.error + '10' }}>
                          <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '500' }}>Spent</Text>
                          <Text style={{ color: COLORS.error, fontSize: 12, fontWeight: '700' }}>− {fmt(spent, currency)}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: COLORS.success + '08', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.success + '10' }}>
                          <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '500' }}>Received</Text>
                          <Text style={{ color: COLORS.success, fontSize: 12, fontWeight: '700' }}>+ {fmt(received, currency)}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.divider, marginTop: 12, paddingTop: 10, justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={styles.accountTypeBadge}>
                        <Text style={styles.accountTypeBadgeText}>{typeLabel}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 14 }}>
                        <TouchableOpacity onPress={() => openTransfer(acct)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Icons.ArrowRightLeft color={COLORS.primary} size={14} />
                          <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>Transfer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openEdit(acct)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Pencil color={COLORS.textSecondary} size={14} />
                          <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' }}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(acct)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Trash2 color={COLORS.error} size={14} />
                          <Text style={{ color: COLORS.error, fontSize: 12, fontWeight: '600' }}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : (
          <>
            {/* ════════════════════════════════════════
                DETAILS TAB
            ════════════════════════════════════════ */}

            {/* Account selector */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Select Account</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: SIZES.padding, marginBottom: 8 }}>
              <TouchableOpacity
                style={[styles.detailsPill, !detailsAccountId && styles.detailsPillActive]}
                onPress={() => setDetailsAccountId(null)}
              >
                <Text style={[styles.detailsPillText, !detailsAccountId && styles.detailsPillTextActive]}>All Accounts</Text>
              </TouchableOpacity>
              {accounts.map(acct => (
                <TouchableOpacity
                  key={acct.id}
                  style={[styles.detailsPill, detailsAccountId === acct.id && styles.detailsPillActive]}
                  onPress={() => setDetailsAccountId(acct.id)}
                >
                  <View style={[styles.detailsPillDot, { backgroundColor: acct.color }]} />
                  <Text style={[styles.detailsPillText, detailsAccountId === acct.id && styles.detailsPillTextActive]}>
                    {acct.account_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Period filter */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Period</Text>
            </View>
            <View style={styles.detailsPeriodRow}>
              {[
                { key: '1W', label: '1W' },
                { key: '1M', label: '1M' },
                { key: '3M', label: '3M' },
                { key: '6M', label: '6M' },
                { key: '1Y', label: '1Y' },
                { key: 'ALL', label: 'All' },
              ].map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.detailsPeriodBtn, detailsPeriod === p.key && styles.detailsPeriodBtnActive]}
                  onPress={() => setDetailsPeriod(p.key)}
                >
                  <Text style={[styles.detailsPeriodText, detailsPeriod === p.key && styles.detailsPeriodTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Summary card */}
            <View style={[styles.detailsSummaryCard, { marginHorizontal: SIZES.padding, marginTop: 8 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.detailsSummaryLabel, { color: COLORS.error }]}>
                  Spent
                </Text>
                <Text style={[styles.detailsSummaryValue, { color: COLORS.error }]}>
                  − {fmt(detailsData.spent, currency)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <Text style={[styles.detailsSummaryLabel, { color: COLORS.success }]}>
                  Received
                </Text>
                <Text style={[styles.detailsSummaryValue, { color: COLORS.success }]}>
                  + {fmt(detailsData.received, currency)}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: COLORS.divider, marginVertical: 8 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.detailsSummaryLabel, { color: COLORS.text }]}>
                  Net
                </Text>
                <Text style={[styles.detailsSummaryValue, {
                  color: detailsData.received - detailsData.spent >= 0 ? COLORS.success : COLORS.error,
                }]}>
                  {fmt(detailsData.received - detailsData.spent, currency)}
                </Text>
              </View>
              <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 6 }}>
                {detailsData.count} transaction{detailsData.count !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* Transaction list */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Transactions</Text>
            </View>

            {detailsLoading ? (
              <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 20 }} />
            ) : detailsData.transactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No Transactions</Text>
                <Text style={styles.emptySubtitle}>No transactions found for the selected filters.</Text>
              </View>
            ) : (
              detailsData.transactions.map(tx => (
                <View key={tx.id} style={[styles.accountCard, { flexDirection: 'row', alignItems: 'center', padding: 14 }]}>
                  <View style={{
                    width: 38, height: 38, borderRadius: 12,
                    backgroundColor: tx.type === 'expense' ? COLORS.error + '15' : COLORS.success + '15',
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 16 }}>
                      {tx.type === 'expense' ? '↓' : '↑'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                      {tx.title || tx.description || 'Transaction'}
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 1 }}>
                      {new Date(tx.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {tx.description && tx.description !== tx.title ? ` · ${tx.description}` : ''}
                    </Text>
                  </View>
                  <Text style={{
                    color: tx.type === 'expense' ? COLORS.error : COLORS.success,
                    fontSize: 15, fontWeight: '800',
                  }}>
                    {tx.type === 'expense' ? '−' : '+'}{fmt(tx.amount, currency)}
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 24 }]} onPress={openAdd}>
        <Plus color="#fff" size={26} />
      </TouchableOpacity>

      {/* ══════════════════════════════════════
          ADD / EDIT ACCOUNT MODAL
      ══════════════════════════════════════ */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
            <Pressable style={styles.modalSheet} onPress={() => { }}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingAcct ? 'Edit Account' : 'Add Account'}
                </Text>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowModal(false)}>
                  <X color={COLORS.textSecondary} size={18} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>Bank / Institution Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. HBL, Meezan, JazzCash"
                  placeholderTextColor={COLORS.textSecondary}
                  value={bankName}
                  onChangeText={setBankName}
                />

                <Text style={styles.fieldLabel}>Account Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Main Savings, Salary Account"
                  placeholderTextColor={COLORS.textSecondary}
                  value={acctName}
                  onChangeText={setAcctName}
                />

                <Text style={styles.fieldLabel}>Account Type</Text>
                <View style={styles.typeRow}>
                  {ACCOUNT_TYPES.map(t => (
                    <TouchableOpacity
                      key={t.key}
                      style={[
                        styles.typeBtn,
                        acctType === t.key && { ...styles.typeBtnActive, backgroundColor: acctColor },
                      ]}
                      onPress={() => setAcctType(t.key)}
                    >
                      <Text style={[
                        styles.typeBtnText,
                        acctType === t.key && styles.typeBtnTextActive,
                      ]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Current Balance *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                  value={balance}
                  onChangeText={setBalance}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.fieldLabel}>Color</Text>
                <View style={styles.colorRow}>
                  {PRESET_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c },
                        acctColor === c && styles.colorDotSelected,
                      ]}
                      onPress={() => setAcctColor(c)}
                    />
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Icon</Text>
                <View style={styles.iconRow}>
                  {ICON_OPTIONS.map(({ key, Icon }) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.iconBtn, acctIcon === key && styles.iconBtnActive]}
                      onPress={() => setAcctIcon(key)}
                    >
                      <Icon color={acctIcon === key ? acctColor : COLORS.textSecondary} size={20} />
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: acctColor }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.saveBtnText}>
                    {saving ? 'Saving…' : editingAcct ? 'Save Changes' : 'Add Account'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════
          TRANSFER MODAL
      ══════════════════════════════════════ */}
      <Modal
        visible={showTransfer}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTransfer(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowTransfer(false)}>
            <Pressable style={styles.modalSheet} onPress={() => { }}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Transfer Funds</Text>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowTransfer(false)}>
                  <X color={COLORS.textSecondary} size={18} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} keyboardShouldPersistTaps="handled">
                {/* From Account */}
                <Text style={styles.fieldLabel}>From Account</Text>
                <View style={[styles.textInput, { justifyContent: 'center', paddingVertical: 12 }]}>
                  <Text style={{ color: COLORS.text, fontWeight: '600' }}>
                    {transferFrom?.account_name}
                  </Text>
                  {!!transferFrom?.bank_name && (
                    <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2, fontWeight: '500' }}>
                      {transferFrom.bank_name}
                    </Text>
                  )}
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>
                    Balance: {fmt(transferFrom?.balance || 0, currency)}
                  </Text>
                  {transferAmount && parseFloat(transferAmount) > 0 && (
                    <Text style={{ color: COLORS.error, fontSize: 12, marginTop: 2, fontWeight: '700' }}>
                      After transfer: {fmt(projectedFromBalance, currency)}
                    </Text>
                  )}
                </View>

                {/* To Account Selector */}
                <Text style={styles.fieldLabel} style={{ marginTop: 16 }}>To Account *</Text>
                <View style={{ borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' }}>
                  {accounts
                    .filter(a => a.id !== transferFrom?.id)
                    .map(acct => (
                      <TouchableOpacity
                        key={acct.id}
                        style={[
                          { padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
                          transferTo?.id === acct.id && { backgroundColor: COLORS.primary + '22' }
                        ]}
                        onPress={() => setTransferTo(acct)}
                      >
                        <View>
                          <Text style={{ color: COLORS.text, fontWeight: '600' }}>{acct.account_name}</Text>
                          {!!acct.bank_name && (
                            <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2, fontWeight: '500' }}>
                              {acct.bank_name}
                            </Text>
                          )}
                          <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 4 }}>
                            {transferTo?.id === acct.id && transferAmount && parseFloat(transferAmount) > 0
                              ? 'Projected: '
                              : 'Current: '}
                            {fmt(
                              transferTo?.id === acct.id && transferAmount && parseFloat(transferAmount) > 0
                                ? Number(acct.balance) + (parseFloat(transferAmount) || 0)
                                : acct.balance,
                              currency
                            )}
                          </Text>
                        </View>
                        {transferTo?.id === acct.id && (
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))
                  }
                </View>

                {/* Amount */}
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Amount *</Text>
                <TextInput
                  style={[styles.textInput, insufficientBalance && { borderColor: COLORS.error, borderWidth: 2 }]}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textSecondary}
                  value={transferAmount}
                  onChangeText={setTransferAmount}
                  keyboardType="decimal-pad"
                />
                {insufficientBalance && (
                  <Text style={{ color: COLORS.error, fontSize: 12, fontWeight: '700', marginTop: -12, marginBottom: 16 }}>
                    Insufficient balance. Available: {fmt(transferFrom?.balance || 0, currency)}
                  </Text>
                )}

                {/* Notes */}
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { height: 80 }]}
                  placeholder="e.g. Salary transfer"
                  placeholderTextColor={COLORS.textSecondary}
                  value={transferNotes}
                  onChangeText={setTransferNotes}
                  multiline
                  textAlignVertical="top"
                />

                {/* Projected Balance Preview */}
                {transferAmount && parseFloat(transferAmount) > 0 && transferFrom && (
                  <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border }}>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10 }}>Projected Balances</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '600' }}>{transferFrom.account_name}</Text>
                      <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700' }}>
                        <Text style={{ color: COLORS.textSecondary }}>{fmt(transferFrom.balance, currency)}</Text>
                        {'  →  '}
                        <Text style={{ color: COLORS.error }}>{fmt(projectedFromBalance, currency)}</Text>
                      </Text>
                    </View>
                    {transferTo && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '600' }}>{transferTo.account_name}</Text>
                        <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700' }}>
                          <Text style={{ color: COLORS.textSecondary }}>{fmt(transferTo.balance, currency)}</Text>
                          {'  →  '}
                          <Text style={{ color: COLORS.accent }}>{fmt(projectedToBalance, currency)}</Text>
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: transferAmount && transferTo && !insufficientBalance ? COLORS.primary : COLORS.primary + '66', marginTop: 20 }]}
                  onPress={handleTransfer}
                  disabled={transferring || !transferAmount || !transferTo || insufficientBalance}
                >
                  <Text style={styles.saveBtnText}>
                    {transferring ? 'Transferring...' : insufficientBalance ? 'Insufficient Balance' : 'Transfer'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default Accounts;
