import React, { useState, useCallback, useMemo } from 'react';
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
import { useDrawer }  from '../../context/DrawerContext';
import { useAuth }    from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useTheme }   from '../../context/ThemeContext';
import { makeStyles } from './styles';
import { accountService } from '../../services/accountService';
import HeaderPlusButton from '../../components/HeaderPlusButton';

/* ─── constants ────────────────────────────────────────────────────────── */

const ACCOUNT_TYPES = [
  { key: 'savings',  label: 'Savings' },
  { key: 'current',  label: 'Current' },
  { key: 'wallet',   label: 'Wallet' },
  { key: 'cash',     label: 'Cash' },
  { key: 'credit',   label: 'Credit' },
];

const PRESET_COLORS = [
  '#4f5ff7', '#22c55e', '#ef4444', '#f97316',
  '#8B5CF6', '#0EA5E9', '#EC4899', '#14B8A6',
];

const ICON_OPTIONS = [
  { key: 'Wallet',      Icon: Wallet },
  { key: 'Building2',   Icon: Building2 },
  { key: 'CreditCard',  Icon: CreditCard },
  { key: 'Smartphone',  Icon: Smartphone },
  { key: 'Coins',       Icon: Coins },
  { key: 'PiggyBank',   Icon: PiggyBank },
];

const fmt = (n, cur) =>
  `${cur} ${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/* ════════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
════════════════════════════════════════════════════════════════════════════ */

const Accounts = () => {
  const { openDrawer }     = useDrawer();
  const { userId }         = useAuth();
  const { currency }       = useProfile();
  const { colors: COLORS } = useTheme();
  const styles             = useMemo(() => makeStyles(COLORS), [COLORS]);
  const insets             = useSafeAreaInsets();

  /* ── data ──────────────────────────────────────────────────────────── */
  const [accounts, setAccounts] = useState([]);
  const [loading,  setLoading]  = useState(true);

  /* ── modal state ────────────────────────────────────────────────────── */
  const [showModal,    setShowModal]    = useState(false);
  const [editingAcct,  setEditingAcct]  = useState(null);
  const [bankName,     setBankName]     = useState('');
  const [acctName,     setAcctName]     = useState('');
  const [acctType,     setAcctType]     = useState('savings');
  const [balance,      setBalance]      = useState('');
  const [acctColor,    setAcctColor]    = useState(PRESET_COLORS[0]);
  const [acctIcon,     setAcctIcon]     = useState('Wallet');
  const [saving,       setSaving]       = useState(false);

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

  const showPageInfo = () => Alert.alert('About This Page', 'Manage your bank accounts and wallets. Track balances, add new accounts, and see monthly activity per account.');

  /* ── computed ───────────────────────────────────────────────────────── */
  const totalBalance       = useMemo(() => accounts.reduce((s, a) => s + (Number(a.balance)          || 0), 0), [accounts]);
  const totalMonthlySpent  = useMemo(() => accounts.reduce((s, a) => s + (Number(a.monthly_spent)    || 0), 0), [accounts]);
  const totalMonthlyIn     = useMemo(() => accounts.reduce((s, a) => s + (Number(a.monthly_received) || 0), 0), [accounts]);

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
        id:           editingAcct?.id,
        bank_name:    bankName.trim(),
        account_name: acctName.trim(),
        account_type: acctType,
        balance:      bal,
        color:        acctColor,
        icon:         acctIcon,
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
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await accountService.deleteAccount(acct.id);
            fetchAccounts();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        }},
      ]
    );
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

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>

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
            const spent    = Number(acct.monthly_spent    || 0);
            const received = Number(acct.monthly_received || 0);
            const balance  = Number(acct.balance          || 0);
            // spendable = current balance + what was spent this month (i.e. starting balance this month)
            const spendable   = balance + spent;
            const spendPct    = spendable > 0 ? Math.min((spent / spendable) * 100, 100) : 0;
            const typeLabel   = ACCOUNT_TYPES.find(t => t.key === acct.account_type)?.label ?? acct.account_type;

            return (
              <View key={acct.id} style={[styles.accountCard, { flexDirection: 'column', alignItems: 'stretch' }]}>
                {/* Top row: icon + info + balance + actions */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.accountIconWrap, { backgroundColor: acct.color + '22' }]}>
                    {renderIcon(acct.icon, 22, acct.color)}
                  </View>

                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName} numberOfLines={1}>{acct.account_name}</Text>
                    {!!acct.bank_name && (
                      <Text style={styles.accountBank} numberOfLines={1}>{acct.bank_name}</Text>
                    )}
                    <View style={styles.accountTypeBadge}>
                      <Text style={styles.accountTypeBadgeText}>{typeLabel}</Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                    <Text style={[styles.accountBalance, { color: acct.color }]}>
                      {fmt(balance, currency)}
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 10 }}>Current Balance</Text>
                  </View>

                  <View style={styles.accountActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(acct)}>
                      <Pencil color={COLORS.textSecondary} size={16} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(acct)}>
                      <Trash2 color={COLORS.error} size={16} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Spending progress bar */}
                <View style={{ marginTop: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' }}>
                      This month's spending
                    </Text>
                    <Text style={{ color: spendPct > 75 ? COLORS.error : spendPct > 50 ? COLORS.warning : COLORS.success, fontSize: 11, fontWeight: '700' }}>
                      {spendPct.toFixed(0)}% spent
                    </Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: COLORS.surface, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{
                      height: '100%', borderRadius: 3,
                      width: `${spendPct}%`,
                      backgroundColor: spendPct > 75 ? COLORS.error : spendPct > 50 ? COLORS.warning : acct.color,
                    }} />
                  </View>

                  {/* Stat chips */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <View style={{ flex: 1, backgroundColor: COLORS.error + '12', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ color: COLORS.error, fontSize: 13, fontWeight: '800' }}>
                        − {fmt(spent, currency)}
                      </Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 10, marginTop: 2 }}>Spent</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: COLORS.success + '12', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ color: COLORS.success, fontSize: 13, fontWeight: '800' }}>
                        + {fmt(received, currency)}
                      </Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 10, marginTop: 2 }}>Received</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: acct.color + '12', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ color: acct.color, fontSize: 13, fontWeight: '800' }}>
                        {fmt(balance, currency)}
                      </Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 10, marginTop: 2 }}>Remaining</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
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
            <Pressable style={styles.modalSheet} onPress={() => {}}>
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
    </SafeAreaView>
  );
};

export default Accounts;
