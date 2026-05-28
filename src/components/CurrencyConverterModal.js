import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, Modal, Pressable, TextInput, StyleSheet,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeftRight, X, RefreshCw, ChevronDown, Check } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { SIZES } from '../constants/theme';

const CURRENCIES = [
  { code: 'USD', symbol: '$',   label: 'US Dollar'        },
  { code: 'EUR', symbol: '€',   label: 'Euro'             },
  { code: 'GBP', symbol: '£',   label: 'British Pound'    },
  { code: 'PLN', symbol: 'zł',  label: 'Polish Zloty'     },
  { code: 'PKR', symbol: '₨',   label: 'Pakistani Rupee'  },
  { code: 'SAR', symbol: '﷼',   label: 'Saudi Riyal'      },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham'       },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar'  },
  { code: 'AUD', symbol: 'A$',  label: 'Australian Dollar'},
];

const RATES_KEY    = 'currency_rates_cache';
const RATES_TS_KEY = 'currency_rates_timestamp';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const API_URL      = 'https://open.er-api.com/v6/latest/USD';

export default function CurrencyConverterModal({ visible, onClose }) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [rates,      setRates]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [from,       setFrom]       = useState('USD');
  const [to,         setTo]         = useState('PKR');
  const [amount,     setAmount]     = useState('1');
  const [picker,     setPicker]     = useState(null); // 'from' | 'to' | null

  useEffect(() => {
    if (visible) loadRates();
  }, [visible]);

  const loadRates = async () => {
    try {
      const ts        = await AsyncStorage.getItem(RATES_TS_KEY);
      const cached    = await AsyncStorage.getItem(RATES_KEY);
      const now       = Date.now();
      if (ts && cached && now - Number(ts) < CACHE_TTL_MS) {
        setRates(JSON.parse(cached));
        setLastUpdate(new Date(Number(ts)));
        return;
      }
    } catch (_) {}
    fetchRates();
  };

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res  = await fetch(API_URL);
      const json = await res.json();
      if (json?.rates) {
        const now = Date.now();
        setRates(json.rates);
        setLastUpdate(new Date(now));
        await AsyncStorage.setItem(RATES_KEY,    JSON.stringify(json.rates));
        await AsyncStorage.setItem(RATES_TS_KEY, String(now));
      }
    } catch (_) {
      Alert.alert('No connection', 'Could not fetch latest rates. Showing cached rates if available.');
    }
    setLoading(false);
  };

  const convert = useCallback(() => {
    if (!rates) return null;
    const a   = parseFloat(amount) || 0;
    const usdAmount = a / (rates[from] || 1);
    return usdAmount * (rates[to] || 1);
  }, [rates, from, to, amount]);

  const result  = convert();
  const toCurr  = CURRENCIES.find(c => c.code === to);
  const fromCurr = CURRENCIES.find(c => c.code === from);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const selectCurrency = (code) => {
    if (picker === 'from') setFrom(code);
    else setTo(code);
    setPicker(null);
  };

  const formatResult = (n) => {
    if (n === null || isNaN(n)) return '—';
    if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return n.toFixed(4).replace(/\.?0+$/, '');
  };

  const formatRate = () => {
    if (!rates) return null;
    const r = (rates[to] || 1) / (rates[from] || 1);
    return `1 ${from} = ${formatResult(r)} ${to}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Currency Converter</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pressable onPress={fetchRates} hitSlop={8} style={{ padding: 4 }}>
              {loading
                ? <ActivityIndicator color={COLORS.primary} size="small" />
                : <RefreshCw color={COLORS.textSecondary} size={18} />}
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
              <X color={COLORS.textSecondary} size={22} />
            </Pressable>
          </View>
        </View>

        {/* Last updated */}
        {lastUpdate && (
          <Text style={styles.lastUpdate}>
            Rates updated {lastUpdate.toLocaleDateString()} {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}

        {/* Converter card */}
        <View style={styles.card}>
          {/* From row */}
          <View style={styles.fieldRow}>
            <Pressable style={styles.currencyBtn} onPress={() => setPicker('from')}>
              <Text style={styles.currencyCode}>{from}</Text>
              <Text style={styles.currencyLabel}>{fromCurr?.label}</Text>
              <ChevronDown color={COLORS.textSecondary} size={16} />
            </Pressable>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={COLORS.textSecondary}
              textAlign="right"
              autoFocus={false}
            />
          </View>

          {/* Swap button */}
          <View style={styles.swapRow}>
            <View style={styles.dividerLine} />
            <Pressable style={styles.swapBtn} onPress={swap}>
              <ArrowLeftRight color={COLORS.primary} size={18} />
            </Pressable>
            <View style={styles.dividerLine} />
          </View>

          {/* To row */}
          <View style={styles.fieldRow}>
            <Pressable style={styles.currencyBtn} onPress={() => setPicker('to')}>
              <Text style={styles.currencyCode}>{to}</Text>
              <Text style={styles.currencyLabel}>{toCurr?.label}</Text>
              <ChevronDown color={COLORS.textSecondary} size={16} />
            </Pressable>
            <Text style={styles.resultText}>
              {loading && !rates ? '…' : formatResult(result)}
            </Text>
          </View>
        </View>

        {/* Exchange rate hint */}
        {rates && (
          <Text style={styles.rateHint}>{formatRate()}</Text>
        )}

        {!rates && !loading && (
          <Pressable style={styles.retryBtn} onPress={fetchRates}>
            <Text style={styles.retryText}>Tap to load exchange rates</Text>
          </Pressable>
        )}

        {/* Currency picker list */}
        {picker && (
          <View style={styles.pickerPanel}>
            <Text style={styles.pickerTitle}>
              Select {picker === 'from' ? 'From' : 'To'} Currency
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CURRENCIES.map(c => {
                const active = picker === 'from' ? from === c.code : to === c.code;
                return (
                  <Pressable
                    key={c.code}
                    style={({ pressed }) => [
                      styles.pickerRow,
                      active && styles.pickerRowActive,
                      pressed && { opacity: 0.6 },
                    ]}
                    onPress={() => selectCurrency(c.code)}
                  >
                    <Text style={[styles.pickerCode, active && { color: COLORS.primary }]}>
                      {c.code}
                    </Text>
                    <Text style={styles.pickerLabel}>{c.label}</Text>
                    <Text style={styles.pickerSymbol}>{c.symbol}</Text>
                    {active && <Check color={COLORS.primary} size={16} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  lastUpdate: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    paddingTop: 8,
    paddingBottom: 2,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    margin: SIZES.padding,
    padding: SIZES.padding,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  currencyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currencyCode: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  currencyLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  amountInput: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '600',
    minWidth: 100,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  swapBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  resultText: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: '700',
    minWidth: 100,
    textAlign: 'right',
  },
  rateHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  retryBtn: {
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary + '20',
    borderRadius: 20,
  },
  retryText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  pickerPanel: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: SIZES.padding,
  },
  pickerTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerRowActive: {
    backgroundColor: COLORS.primary + '12',
    borderRadius: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  pickerCode: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    width: 44,
  },
  pickerLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  pickerSymbol: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
