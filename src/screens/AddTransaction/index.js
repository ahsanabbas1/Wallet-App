import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, Alert, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback, Keyboard, ActivityIndicator, Pressable,
  Modal, TouchableOpacity
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Icons from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { makeStyles } from './styles';
import AppButton from '../../components/Common/AppButton';
import AppInput from '../../components/Common/AppInput';
import { transactionService } from '../../services/transactionService';
import { generateNotifications } from '../../services/notificationService';
import { accountService } from '../../services/accountService';

// ─── Safe math evaluator (no eval / Function() — Hermes-compatible) ─────────
// Recursive descent parser: handles +, -, *, /, parentheses, decimals
function safeMath(expr) {
  let pos = 0;
  const E = String(expr).replace(/\s/g, '');

  const peek = () => E[pos];

  function parseNumber() {
    let s = '';
    if (E[pos] === '-') s += E[pos++];
    while (pos < E.length && (E[pos] >= '0' && E[pos] <= '9' || E[pos] === '.')) s += E[pos++];
    if (s === '' || s === '-') throw new Error('Invalid');
    return parseFloat(s);
  }

  function parseFactor() {
    if (peek() === '(') {
      pos++; // consume '('
      const v = parseAddSub();
      if (peek() !== ')') throw new Error('Mismatched parentheses');
      pos++; // consume ')'
      return v;
    }
    if (peek() === '-') { pos++; return -parseFactor(); }
    return parseNumber();
  }

  function parseMulDiv() {
    let left = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = E[pos++];
      const right = parseFactor();
      if (op === '*') left *= right;
      else {
        if (right === 0) throw new Error('Division by zero');
        left /= right;
      }
    }
    return left;
  }

  function parseAddSub() {
    let left = parseMulDiv();
    while (peek() === '+' || (peek() === '-' && pos > 0)) {
      const op = E[pos++];
      left = op === '+' ? left + parseMulDiv() : left - parseMulDiv();
    }
    return left;
  }

  const result = parseAddSub();
  if (pos < E.length) throw new Error('Invalid expression');
  if (!isFinite(result)) throw new Error('Math error');
  return result;
}

// ─── Inline Calculator ──────────────────────────────────────────────────────

const CALC_BUTTONS = [
  ['C', '←', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['±', '0', '.', '='],
];

const Calculator = ({ onUseResult, onClose }) => {
  const { colors: COLORS } = useTheme();
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [hasResult, setHasResult] = useState(false);

  const handleButton = (btn) => {
    if (btn === 'C') {
      setDisplay('0');
      setExpression('');
      setHasResult(false);
      return;
    }
    if (btn === '←') {
      if (hasResult) { setDisplay('0'); setExpression(''); setHasResult(false); return; }
      const next = display.length > 1 ? display.slice(0, -1) : '0';
      setDisplay(next);
      return;
    }
    if (btn === '±') {
      const val = parseFloat(display) * -1;
      setDisplay(val.toString());
      return;
    }
    if (['+', '−', '×', '÷', '%'].includes(btn)) {
      const op = btn === '×' ? '*' : btn === '÷' ? '/' : btn === '−' ? '-' : btn === '%' ? '/100*' : '+';
      setExpression((hasResult ? display : expression + display) + op);
      setDisplay('0');
      setHasResult(false);
      return;
    }
    if (btn === '=') {
      try {
        const full = expression + display;
        const result = safeMath(full); // Hermes-safe — no Function() or eval
        const formatted = parseFloat(result.toFixed(8)).toString();
        setDisplay(formatted);
        setExpression(full + '=');
        setHasResult(true);
      } catch {
        setDisplay('Error');
        setHasResult(true);
      }
      return;
    }
    // digit or dot
    if (btn === '.' && display.includes('.')) return;
    const next = hasResult ? btn : (display === '0' && btn !== '.' ? btn : display + btn);
    setDisplay(next);
    setHasResult(false);
  };

  const isOp = (b) => ['+', '−', '×', '÷', '=', '%'].includes(b);
  const isAction = (b) => ['C', '←'].includes(b);

  return (
    <View style={{ backgroundColor: COLORS.card, borderRadius: 24, overflow: 'hidden' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
        <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: 'bold' }}>Calculator</Text>
        <TouchableOpacity onPress={onClose}>
          <Icons.X color={COLORS.textSecondary} size={22} />
        </TouchableOpacity>
      </View>

      {/* Display */}
      <View style={{ backgroundColor: COLORS.background, margin: 12, borderRadius: 16, padding: 16 }}>
        <Text style={{ color: COLORS.textSecondary, fontSize: 13, textAlign: 'right', minHeight: 18 }} numberOfLines={1}>
          {expression}
        </Text>
        <Text style={{ color: COLORS.text, fontSize: 36, fontWeight: 'bold', textAlign: 'right' }} numberOfLines={1} adjustsFontSizeToFit>
          {display}
        </Text>
      </View>

      {/* Buttons */}
      <View style={{ padding: 12, gap: 8 }}>
        {CALC_BUTTONS.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: 8 }}>
            {row.map((btn) => {
              const bgColor = btn === '='
                ? COLORS.accent
                : isOp(btn)
                  ? COLORS.primary + 'cc'
                  : isAction(btn)
                    ? 'rgba(255,255,255,0.12)'
                    : COLORS.background;
              const txtColor = btn === '=' ? '#000' : COLORS.text;
              return (
                <TouchableOpacity
                  key={btn}
                  style={{ flex: 1, backgroundColor: bgColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => handleButton(btn)}
                >
                  <Text style={{ color: txtColor, fontSize: 18, fontWeight: '600' }}>{btn}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Use Result */}
      <TouchableOpacity
        style={{ margin: 12, marginTop: 4, backgroundColor: COLORS.primary, borderRadius: 14, padding: 14, alignItems: 'center' }}
        onPress={() => {
          if (display !== 'Error' && display !== '0') {
            onUseResult(display);
          }
        }}
      >
        <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 15 }}>Use Result → Amount</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const AddTransaction = ({ navigation, route }) => {
  const { userId } = useAuth();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const editTransaction = route.params?.transaction;
  const isEdit = !!editTransaction;

  const [loading, setLoading] = useState(false);
  const [fetchingCategories, setFetchingCategories] = useState(true);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const [form, setForm] = useState({
    type: editTransaction?.type || 'expense',
    amount: editTransaction?.amount?.toString() || '',
    title: editTransaction?.title || '',
    description: editTransaction?.description || ''
  });

  const [date, setDate] = useState(editTransaction?.date ? new Date(editTransaction.date) : new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Record' : 'Add Record' });
    fetchCategories();
  }, [isEdit, userId]);

  const onDateChange = (event, selectedDate) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const showMode = (currentMode) => {
    setPickerMode(currentMode);
    setShowPicker(true);
  };

  const fetchCategories = async () => {
    try {
      setFetchingCategories(true);
      const [data, accts] = await Promise.all([
        transactionService.getCategories(userId),
        accountService.getAccounts(userId).catch(() => []),
      ]);
      if (data && data.length > 0) {
        setCategories(data);
        const filtered = data.filter(c => c.type === form.type || c.type === 'both');
        if (isEdit) {
          const found = data.find(c => c.id === editTransaction.category_id);
          setSelectedCategory(found || filtered[0]);
        } else {
          setSelectedCategory(filtered[0]);
        }
      }
      setAccounts(accts || []);
      if (accts && accts.length > 0) {
        const preselect = isEdit && editTransaction?.account_id
          ? accts.find(a => a.id === editTransaction.account_id) ?? accts[0]
          : accts[0];
        setSelectedAccount(preselect);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not load categories.');
    } finally {
      setFetchingCategories(false);
    }
  };

  const handleSave = async () => {
    const { title, amount, type, description } = form;
    const parsedAmount = parseFloat(amount);
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for this transaction.');
      return;
    }
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than zero.');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('No Category', 'Please select a category.');
      return;
    }
    if (accounts.length > 0 && !selectedAccount) {
      Alert.alert('No Account', 'Please select a bank account for this transaction.');
      return;
    }
    setLoading(true);
    try {
      if (!userId) { Alert.alert('Error', 'You must be logged in.'); return; }
      const transactionData = {
        user_id: userId,
        category_id: selectedCategory.id,
        amount: parseFloat(amount),
        type,
        title,
        description,
        date: date.toISOString(),
        account_id: selectedAccount?.id ?? null,
      };
      let result;
      if (isEdit) {
        result = await transactionService.updateTransaction(editTransaction.id, transactionData);
      } else {
        result = await transactionService.addTransaction(transactionData);
      }
      // Fire-and-forget: generate notifications after every save (budget alerts, spending spikes, etc.)
      generateNotifications(userId).catch(() => {});
      if (result?.queued) {
        Alert.alert('Saved Offline', 'Your record was saved locally and will sync when internet returns.');
      }
      setTimeout(() => navigation.goBack(), 100);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateFormField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleTypeChange = (newType) => {
    updateFormField('type', newType);
    const filtered = categories.filter(c => c.type === newType || c.type === 'both');
    if (filtered.length > 0 && !filtered.find(c => c.id === selectedCategory?.id)) {
      setSelectedCategory(filtered[0]);
    } else if (filtered.length === 0) {
      setSelectedCategory(null);
    }
  };

  const [activeParent, setActiveParent] = useState(null);
  const filteredCategories = categories.filter(c => c.type === form.type || c.type === 'both');
  const parents = filteredCategories.filter(c => !c.parent_id);
  const subs = filteredCategories.filter(c => c.parent_id && (activeParent ? c.parent_id === activeParent.id : true));

  useEffect(() => {
    if (activeParent && !parents.find(p => p.id === activeParent.id)) setActiveParent(null);
  }, [form.type]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent}>

            {/* Type Selector */}
            <View style={styles.typeContainer}>
              <AppButton title="Expense" variant={form.type === 'expense' ? 'primary' : 'secondary'} onPress={() => handleTypeChange('expense')} style={{ flex: 1, borderRadius: 12 }} />
              <AppButton title="Income" variant={form.type === 'income' ? 'primary' : 'secondary'} onPress={() => handleTypeChange('income')} style={{ flex: 1, borderRadius: 12, marginLeft: 10 }} />
            </View>

            {/* Amount + Calculator Button */}
            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.label}>Amount</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary + '44' }}
                  onPress={() => setShowCalcModal(true)}
                >
                  <Icons.Calculator color={COLORS.primary} size={14} />
                  <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600', marginLeft: 6 }}>Calculator</Text>
                </TouchableOpacity>
              </View>
              <AppInput
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={form.amount}
                onChangeText={(val) => updateFormField('amount', val)}
              />
            </View>

            {/* Title */}
            <AppInput label="Title" placeholder="e.g. Grocery Shop" value={form.title} onChangeText={(val) => updateFormField('title', val)} />

            {/* Category Picker */}
            <View style={styles.inputGroup}>
              <View style={styles.pickerHeader}>
                <Text style={styles.label}>{activeParent ? `Category: ${activeParent.name}` : 'Select Category'}</Text>
                {activeParent && (
                  <Pressable onPress={() => setActiveParent(null)}>
                    <Text style={styles.changeText}>Change Group</Text>
                  </Pressable>
                )}
              </View>
              {fetchingCategories ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : !activeParent ? (
                <View style={styles.broadGrid}>
                  {parents.map(parent => (
                    <Pressable key={parent.id} style={[styles.broadCard, { borderBottomColor: parent.color }]} onPress={() => setActiveParent(parent)}>
                      <View style={[styles.broadIconBox, { backgroundColor: parent.color + '10' }]}>
                        {(() => { const IC = Icons[parent.icon] || Icons.Circle; return <IC size={24} color={parent.color} />; })()}
                      </View>
                      <Text style={styles.broadName}>{parent.name}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.categoryList}>
                  {subs.map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={[styles.categoryChip, selectedCategory?.id === cat.id && { backgroundColor: activeParent.color + '40', borderColor: activeParent.color }]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text style={[styles.categoryChipText, selectedCategory?.id === cat.id && { color: activeParent.color, fontWeight: 'bold' }]}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Account Selector — required */}
            {accounts.length > 0 ? (
              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={styles.label}>
                    Account <Text style={{ color: COLORS.error }}>*</Text>
                  </Text>
                  {selectedAccount && (
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' }}>
                      Bal: {Number(selectedAccount.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => setShowAccountPicker(true)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: COLORS.card, borderRadius: 14, padding: 14,
                    borderWidth: 1.5,
                    borderColor: selectedAccount ? selectedAccount.color + '90' : COLORS.error + '80',
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  {selectedAccount ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: selectedAccount.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                        {(() => { const IC = Icons[selectedAccount.icon] || Icons.Wallet; return <IC size={18} color={selectedAccount.color} />; })()}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                          {selectedAccount.account_name}
                        </Text>
                        {!!selectedAccount.bank_name && (
                          <Text style={{ color: COLORS.textSecondary, fontSize: 11 }} numberOfLines={1}>
                            {selectedAccount.bank_name}
                          </Text>
                        )}
                      </View>
                    </View>
                  ) : (
                    <Text style={{ color: COLORS.error, fontSize: 14, flex: 1 }}>Select account (required)</Text>
                  )}
                  <Icons.ChevronDown color={selectedAccount ? COLORS.textSecondary : COLORS.error} size={18} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => navigation.navigate('MainTabs', { screen: 'Accounts' })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.warning + '18', borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: COLORS.warning + '40' }}
              >
                <Icons.AlertCircle color={COLORS.warning} size={18} />
                <Text style={{ color: COLORS.warning, fontSize: 13, flex: 1 }}>
                  No accounts set up — tap to add a bank account
                </Text>
                <Icons.ChevronRight color={COLORS.warning} size={16} />
              </Pressable>
            )}

            {/* Date & Time */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date & Time</Text>
              <View style={styles.dateTimeContainer}>
                <Pressable style={styles.dateTimeField} onPress={() => showMode('date')}>
                  <Icons.Calendar color={COLORS.primary} size={16} style={{ marginRight: 8 }} />
                  <Text style={styles.dateTimeText}>{date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                </Pressable>
                <Pressable style={[styles.dateTimeField, { marginLeft: 10 }]} onPress={() => showMode('time')}>
                  <Icons.Clock color={COLORS.primary} size={16} style={{ marginRight: 8 }} />
                  <Text style={styles.dateTimeText}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </Pressable>
              </View>
              {showPicker && (
                <DateTimePicker
                  testID="dateTimePicker"
                  value={date}
                  mode={pickerMode}
                  is24Hour={false}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                  textColor="white"
                />
              )}
            </View>

            {/* Note */}
            <AppInput
              label={`Note (Optional) ${form.description.length}/250`}
              placeholder="Add a note..."
              multiline
              numberOfLines={3}
              value={form.description}
              onChangeText={(text) => text.length <= 250 && updateFormField('description', text)}
              style={styles.textArea}
            />

            <AppButton title={isEdit ? 'Update Record' : 'Save Transaction'} onPress={handleSave} loading={loading} style={{ marginTop: 20, marginBottom: 20 }} />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Account Picker Modal */}
      <Modal visible={showAccountPicker} transparent animationType="slide" onRequestClose={() => setShowAccountPicker(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setShowAccountPicker(false)}>
          <Pressable style={{ backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28 }} onPress={() => {}}>
            {/* Handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider }}>
              <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '800' }}>Select Account</Text>
              <Pressable onPress={() => setShowAccountPicker(false)} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icons.X color={COLORS.textSecondary} size={16} />
              </Pressable>
            </View>

            {/* Account list */}
            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
              {accounts.map(acct => {
                const isSelected = selectedAccount?.id === acct.id;
                const IC = Icons[acct.icon] || Icons.Wallet;
                const bal = Number(acct.balance || 0);
                return (
                  <Pressable
                    key={acct.id}
                    onPress={() => { setSelectedAccount(acct); setShowAccountPicker(false); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      padding: 14, borderRadius: 16, marginBottom: 0,
                      backgroundColor: isSelected ? acct.color + '18' : COLORS.surface,
                      borderWidth: 1.5,
                      borderColor: isSelected ? acct.color : COLORS.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: acct.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <IC size={20} color={acct.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 15 }}>{acct.account_name}</Text>
                      {!!acct.bank_name && (
                        <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>{acct.bank_name}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: acct.color, fontWeight: '800', fontSize: 15 }}>
                        {bal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>Balance</Text>
                    </View>
                    {isSelected && (
                      <Icons.CheckCircle color={acct.color} size={20} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Safe bottom padding */}
            <View style={{ height: 24 }} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Calculator Modal */}
      <Modal visible={showCalcModal} transparent animationType="fade" onRequestClose={() => setShowCalcModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}>
          <Calculator
            onUseResult={(result) => {
              updateFormField('amount', result);
              setShowCalcModal(false);
            }}
            onClose={() => setShowCalcModal(false)}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default AddTransaction;
