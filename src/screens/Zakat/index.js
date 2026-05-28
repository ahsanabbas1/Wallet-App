import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Menu, Info, RefreshCw, Coins, Building2, ShoppingBag,
  HandCoins, Minus, ChevronDown, ChevronUp, CheckCircle2, XCircle,
} from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDrawer }  from '../../context/DrawerContext';
import { useAuth }    from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useTheme }   from '../../context/ThemeContext';
import { SIZES }      from '../../constants/theme';
import { accountService } from '../../services/accountService';
import { formatAmount } from '../../utils/formatters';

const ZAKAT_RATE  = 0.025; // 2.5%
const GOLD_GRAMS  = 85;    // Nisab by gold
const SILVER_GRAMS = 595;  // Nisab by silver

const ZAKAT_GREEN = '#16a34a';

const fmt = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

const AssetRow = ({ icon: Icon, label, value, onChangeText, hint, color = '#4f5ff7', COLORS, styles }) => (
  <View style={styles.assetRow}>
    <View style={[styles.assetIcon, { backgroundColor: color + '22' }]}>
      <Icon color={color} size={18} />
    </View>
    <View style={styles.assetInfo}>
      <Text style={styles.assetLabel}>{label}</Text>
      {hint ? <Text style={styles.assetHint}>{hint}</Text> : null}
    </View>
    <TextInput
      style={styles.assetInput}
      value={value}
      onChangeText={onChangeText}
      keyboardType="numeric"
      placeholder="0"
      placeholderTextColor={COLORS.textSecondary}
      textAlign="right"
    />
  </View>
);

export default function Zakat() {
  const { openDrawer } = useDrawer();
  const { userId }     = useAuth();
  const { currency }   = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [loading, setLoading] = useState(true);
  const [showNisabInfo, setShowNisabInfo] = useState(false);

  // Nisab inputs
  const [goldPrice,   setGoldPrice]   = useState('');
  const [silverPrice, setSilverPrice] = useState('');

  // Asset inputs (string for controlled TextInput)
  const [cashBalance,  setCashBalance]  = useState('');
  const [goldValue,    setGoldValue]    = useState('');
  const [silverValue,  setSilverValue]  = useState('');
  const [stockValue,   setStockValue]   = useState('');
  const [receivables,  setReceivables]  = useState('');
  const [debts,        setDebts]        = useState('');

  useFocusEffect(useCallback(() => {
    loadBalance();
  }, [userId]));

  const loadBalance = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const total = await accountService.getTotalBalance(userId);
      setCashBalance(total > 0 ? String(Math.round(Number(total))) : '');
    } catch (_) {}
    setLoading(false);
  };

  // Computed values
  const n = (s) => Number(s) || 0;

  const goldNisab   = n(goldPrice)   * GOLD_GRAMS;
  const silverNisab = n(silverPrice) * SILVER_GRAMS;
  const nisabThreshold = Math.min(
    goldNisab   > 0 ? goldNisab   : Infinity,
    silverNisab > 0 ? silverNisab : Infinity,
  );
  const nisabValid = isFinite(nisabThreshold) && nisabThreshold > 0;

  const totalAssets  = n(cashBalance) + n(goldValue) + n(silverValue) + n(stockValue) + n(receivables);
  const totalDebts   = n(debts);
  const zakatableWealth = Math.max(0, totalAssets - totalDebts);
  const zakatDue     = zakatableWealth * ZAKAT_RATE;
  const isEligible   = nisabValid && zakatableWealth >= nisabThreshold;

  const showPageInfo = () => Alert.alert(
    'Zakat Calculator',
    'Zakat is an annual 2.5% obligation on zakatable wealth held above the Nisab threshold for one lunar year (Hawl).\n\nEnter your gold/silver price to calculate the Nisab, then fill in your assets and deduct liabilities to find your Zakat due.',
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={ZAKAT_GREEN} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={openDrawer} style={styles.menuBtn} hitSlop={8}>
            <Menu color={COLORS.text} size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>Zakat Calculator</Text>
          <Pressable onPress={showPageInfo} style={styles.menuBtn} hitSlop={8}>
            <Info color={COLORS.textSecondary} size={20} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Summary card */}
          <LinearGradient
            colors={[ZAKAT_GREEN, '#15803d']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.summaryTop}>
              <Text style={styles.summaryLabel}>Zakatable Wealth</Text>
              <Pressable onPress={loadBalance} hitSlop={8}>
                <RefreshCw color="rgba(255,255,255,0.7)" size={18} />
              </Pressable>
            </View>
            <Text style={styles.summaryAmount}>{currency} {fmt(zakatableWealth)}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryBadge}>
                {isEligible
                  ? <CheckCircle2 color="#fff" size={14} />
                  : <XCircle      color="rgba(255,255,255,0.6)" size={14} />}
                <Text style={styles.summaryBadgeText}>
                  {isEligible ? 'Zakat Due' : nisabValid ? 'Below Nisab' : 'Set Nisab first'}
                </Text>
              </View>
              {isEligible && (
                <Text style={styles.summaryZakatAmt}>{currency} {fmt(zakatDue)}</Text>
              )}
            </View>
          </LinearGradient>

          {/* Nisab section */}
          <Pressable
            style={styles.sectionHeader}
            onPress={() => setShowNisabInfo(v => !v)}
          >
            <Text style={styles.sectionTitle}>Nisab Threshold</Text>
            {showNisabInfo
              ? <ChevronUp   color={COLORS.textSecondary} size={18} />
              : <ChevronDown color={COLORS.textSecondary} size={18} />}
          </Pressable>

          {showNisabInfo && (
            <View style={styles.nisabInfo}>
              <Text style={styles.nisabInfoText}>
                Nisab is the minimum wealth threshold. Enter the current price per gram of gold or silver in your currency to calculate it automatically.
              </Text>
              <Text style={styles.nisabInfoText}>
                • Gold Nisab = {GOLD_GRAMS}g × gold price{goldNisab > 0 ? ` = ${currency} ${fmt(goldNisab)}` : ''}
              </Text>
              <Text style={styles.nisabInfoText}>
                • Silver Nisab = {SILVER_GRAMS}g × silver price{silverNisab > 0 ? ` = ${currency} ${fmt(silverNisab)}` : ''}
              </Text>
              <Text style={[styles.nisabInfoText, { color: ZAKAT_GREEN, marginTop: 4 }]}>
                The lower of the two is used (typically silver).
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.nisabRow}>
              <Coins color={ZAKAT_GREEN} size={18} />
              <Text style={styles.nisabLabel}>Gold price / gram ({currency})</Text>
              <TextInput
                style={styles.nisabInput}
                value={goldPrice}
                onChangeText={setGoldPrice}
                keyboardType="numeric"
                placeholder="e.g. 8500"
                placeholderTextColor={COLORS.textSecondary}
                textAlign="right"
              />
            </View>
            <View style={[styles.nisabRow, { borderBottomWidth: 0 }]}>
              <Coins color="#94a3b8" size={18} />
              <Text style={styles.nisabLabel}>Silver price / gram ({currency})</Text>
              <TextInput
                style={styles.nisabInput}
                value={silverPrice}
                onChangeText={setSilverPrice}
                keyboardType="numeric"
                placeholder="e.g. 100"
                placeholderTextColor={COLORS.textSecondary}
                textAlign="right"
              />
            </View>
            {nisabValid && (
              <View style={styles.nisabResult}>
                <Text style={styles.nisabResultText}>
                  Nisab threshold: {currency} {fmt(nisabThreshold)}
                </Text>
              </View>
            )}
          </View>

          {/* Assets */}
          <Text style={styles.sectionTitle}>Zakatable Assets</Text>
          <View style={styles.card}>
            <AssetRow
              icon={Building2} label="Cash & Bank Balances"
              hint="Auto-loaded from your accounts"
              value={cashBalance} onChangeText={setCashBalance}
              color={ZAKAT_GREEN} COLORS={COLORS} styles={styles}
            />
            <AssetRow
              icon={Coins}  label="Gold Value"
              hint="Current market value"
              value={goldValue} onChangeText={setGoldValue}
              color="#f59e0b" COLORS={COLORS} styles={styles}
            />
            <AssetRow
              icon={Coins}  label="Silver Value"
              hint="Current market value"
              value={silverValue} onChangeText={setSilverValue}
              color="#94a3b8" COLORS={COLORS} styles={styles}
            />
            <AssetRow
              icon={ShoppingBag} label="Business / Trade Inventory"
              hint="Stock held for trade"
              value={stockValue} onChangeText={setStockValue}
              color="#8b5cf6" COLORS={COLORS} styles={styles}
            />
            <AssetRow
              icon={HandCoins} label="Money Owed to You"
              hint="Loans you have given out"
              value={receivables} onChangeText={setReceivables}
              color="#0ea5e9" COLORS={COLORS} styles={styles}
            />
          </View>

          {/* Deductions */}
          <Text style={styles.sectionTitle}>Deductions</Text>
          <View style={styles.card}>
            <AssetRow
              icon={Minus} label="Outstanding Debts"
              hint="Immediate liabilities due"
              value={debts} onChangeText={setDebts}
              color={COLORS.error} COLORS={COLORS} styles={styles}
            />
          </View>

          {/* Breakdown */}
          <Text style={styles.sectionTitle}>Breakdown</Text>
          <View style={styles.card}>
            <BreakdownRow label="Total Assets"       value={totalAssets}      COLORS={COLORS} currency={currency} />
            <BreakdownRow label="Total Deductions"   value={totalDebts}       COLORS={COLORS} currency={currency} isDeduction />
            <BreakdownRow label="Zakatable Wealth"   value={zakatableWealth}  COLORS={COLORS} currency={currency} bold divider />
            {nisabValid && (
              <BreakdownRow label="Nisab Threshold"  value={nisabThreshold}   COLORS={COLORS} currency={currency} />
            )}
            <BreakdownRow
              label="Zakat Due (2.5%)"
              value={isEligible ? zakatDue : 0}
              COLORS={COLORS} currency={currency}
              bold color={isEligible ? ZAKAT_GREEN : COLORS.textSecondary}
              divider
            />
          </View>

          {/* Footer note */}
          <View style={styles.footerNote}>
            <Info color={COLORS.textSecondary} size={14} />
            <Text style={styles.footerNoteText}>
              This calculator is for estimation only. Consult a scholar for your specific situation. Zakat is due on wealth held above Nisab for one full lunar year (Hawl).
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const BreakdownRow = ({ label, value, currency, bold, color, divider, isDeduction, COLORS }) => (
  <>
    {divider && <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 8 }} />}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{
        color: bold ? COLORS.text : COLORS.textSecondary,
        fontSize: bold ? 14 : 13,
        fontWeight: bold ? '700' : '400',
      }}>{label}</Text>
      <Text style={{
        color: color || (isDeduction ? COLORS.error : COLORS.text),
        fontSize: bold ? 15 : 13,
        fontWeight: bold ? '800' : '600',
      }}>
        {isDeduction ? '− ' : ''}{currency} {fmt(value)}
      </Text>
    </View>
  </>
);

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
  menuBtn: {
    padding: 4,
    width: 36,
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    padding: SIZES.padding,
  },
  summaryCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  summaryAmount: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  summaryBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryZakatAmt: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SIZES.padding,
    paddingVertical: 4,
  },
  nisabInfo: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.padding,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  nisabInfoText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  nisabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  nisabLabel: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },
  nisabInput: {
    width: 110,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  nisabResult: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  nisabResultText: {
    color: ZAKAT_GREEN,
    fontSize: 13,
    fontWeight: '700',
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  assetIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetInfo: {
    flex: 1,
  },
  assetLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  assetHint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  assetInput: {
    width: 110,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  footerNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'flex-start',
  },
  footerNoteText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
