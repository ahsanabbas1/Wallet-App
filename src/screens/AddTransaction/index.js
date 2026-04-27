import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Alert, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback, Keyboard, ActivityIndicator, Pressable,
  Modal, TouchableOpacity
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Icons from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import styles from './styles';
import { COLORS } from '../../constants/theme';
import AppButton from '../../components/Common/AppButton';
import AppInput from '../../components/Common/AppInput';
import { transactionService } from '../../services/transactionService';
import { generateNotifications } from '../../services/notificationService';

// ─── Inline Calculator ──────────────────────────────────────────────────────

const CALC_BUTTONS = [
  ['C', '←', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['±', '0', '.', '='],
];

const Calculator = ({ onUseResult, onClose }) => {
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
        // Safe evaluation: only allow digits, operators, dots and parentheses
        if (!/^[\d+\-*/().\s]+$/.test(full)) throw new Error('Invalid');
        const result = Function('"use strict"; return (' + full + ')')();
        if (!isFinite(result)) throw new Error('Invalid');
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
  const editTransaction = route.params?.transaction;
  const isEdit = !!editTransaction;

  const [loading, setLoading] = useState(false);
  const [fetchingCategories, setFetchingCategories] = useState(true);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCalcModal, setShowCalcModal] = useState(false);

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
  }, [isEdit]);

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
      const data = await transactionService.getCategories();
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
      };
      if (isEdit) {
        await transactionService.updateTransaction(editTransaction.id, transactionData);
      } else {
        await transactionService.addTransaction(transactionData);
      }
      // Fire-and-forget: generate notifications after every save (budget alerts, spending spikes, etc.)
      generateNotifications(userId).catch(() => {});
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
