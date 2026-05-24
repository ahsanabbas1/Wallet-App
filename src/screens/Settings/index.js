import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, User, DollarSign, LogOut, Save, ChevronRight, Bell, Shield, Info, Moon, Sun, Building2, BookOpen, Landmark } from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { SIZES } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

const CURRENCIES = [
  { code: 'PKR', symbol: 'Rs', label: 'Pakistani Rupee' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'SAR', symbol: '﷼', label: 'Saudi Riyal' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
];

const SectionHeader = ({ title }) => {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return <Text style={styles.sectionHeader}>{title}</Text>;
};

const SettingRow = ({ icon: Icon, label, value, onPress, rightElement, color }) => {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: (color || COLORS.primary) + '22' }]}>
        <Icon color={color || COLORS.primary} size={18} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {rightElement || <ChevronRight color={COLORS.textSecondary} size={18} />}
    </Pressable>
  );
};

export default function Settings() {
  const navigation = useNavigation();
  const { openDrawer } = useDrawer();
  const { userId, user } = useAuth();
  const { updateCurrency, updateName: updateProfileName, madhab, updateMadhab } = useProfile();
  const { colors: COLORS, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [nameEdit, setNameEdit] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showMadhabPicker,  setShowMadhabPicker]  = useState(false);
  const [editingName, setEditingName] = useState(false);

  const loadProfile = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setEmail(user?.email || '');

      // 1. Fetch Name (Required)
      const { data: profile, error: nameError } = await supabase
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();

      if (nameError) throw nameError;

      if (profile) {
        setName(profile.name || '');
        setNameEdit(profile.name || '');
      }

      // 2. Fetch currency
      const { data: prefData } = await supabase
        .from('users')
        .select('currency')
        .eq('id', userId)
        .single();

      if (prefData?.currency) setCurrency(prefData.currency);
    } catch (e) {
      console.warn('Profile load error:', e.message);
      // Fallback for name from user object if DB fails
      if (!name) {
        const fallbackName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';
        setName(fallbackName);
        setNameEdit(fallbackName);
      }
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadProfile(); }, [userId]));

  const saveName = async () => {
    if (!nameEdit.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: nameEdit.trim() })
        .eq('id', userId);
      if (error) throw error;
      const saved = nameEdit.trim();
      setName(saved);
      updateProfileName(saved); // propagate to ProfileContext → Dashboard updates instantly
      setEditingName(false);
      Alert.alert('Saved', 'Your name has been updated.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveCurrency = async (code) => {
    setCurrency(code);
    setShowCurrencyPicker(false);
    updateCurrency(code); // update global ProfileContext immediately
    try {
      const { error } = await supabase
        .from('users')
        .update({ currency: code, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
    } catch (e) {
      // Revert on failure
      setCurrency(currency);
      updateCurrency(currency);
      Alert.alert('Error', 'Could not save currency. Please try again.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        }
      }
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.7 }]}
            onPress={openDrawer}
          >
            <Menu color={COLORS.text} size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* Avatar / Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(name || email || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{name || 'No name set'}</Text>
          <Text style={styles.profileEmail}>{email}</Text>
        </View>

        {/* Profile settings */}
        <SectionHeader title="Profile" />
        <View style={styles.card}>
          {editingName ? (
            <View style={styles.editRow}>
              <View style={[styles.rowIcon, { backgroundColor: COLORS.primary + '22' }]}>
                <User color={COLORS.primary} size={18} />
              </View>
              <TextInput
                style={styles.input}
                value={nameEdit}
                onChangeText={setNameEdit}
                placeholder="Enter your name"
                placeholderTextColor={COLORS.textSecondary}
                autoFocus
              />
              <Pressable
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveName}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Save color="#fff" size={18} />}
              </Pressable>
            </View>
          ) : (
            <SettingRow
              icon={User}
              label="Display Name"
              value={name || 'Not set'}
              onPress={() => setEditingName(true)}
            />
          )}
        </View>

        {/* Currency */}
        <SectionHeader title="Preferences" />
        <View style={styles.card}>
          <SettingRow
            icon={DollarSign}
            label="Currency"
            value={`${currency} (${CURRENCIES.find(c => c.code === currency)?.symbol || ''})`}
            onPress={() => setShowCurrencyPicker(v => !v)}
          />
          {showCurrencyPicker && (
            <View style={styles.picker}>
              {CURRENCIES.map(c => (
                <Pressable
                  key={c.code}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    currency === c.code && styles.pickerRowActive,
                    pressed && { opacity: 0.6 }
                  ]}
                  onPress={() => saveCurrency(c.code)}
                >
                  <Text style={[
                    styles.pickerCode,
                    currency === c.code && { color: COLORS.primary }
                  ]}>
                    {c.code}
                  </Text>
                  <Text style={styles.pickerLabel}>{c.label}</Text>
                  <Text style={styles.pickerSymbol}>{c.symbol}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <SettingRow
            icon={BookOpen}
            label="School of Thought"
            value={madhab === 'shia' ? 'Shia (Ithna-Ashari)' : 'Sunni'}
            onPress={() => setShowMadhabPicker(v => !v)}
          />
          {showMadhabPicker && (
            <View style={styles.picker}>
              {[{ key: 'sunni', label: 'Sunni' }, { key: 'shia', label: 'Shia (Ithna-Ashari)' }].map(m => (
                <Pressable
                  key={m.key}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    madhab === m.key && styles.pickerRowActive,
                    pressed && { opacity: 0.6 }
                  ]}
                  onPress={() => { updateMadhab(m.key); setShowMadhabPicker(false); }}
                >
                  <Text style={[styles.pickerCode, madhab === m.key && { color: COLORS.primary }]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: COLORS.primary + '22' }]}>
              {isDark ? <Moon color={COLORS.primary} size={18} /> : <Sun color={COLORS.primary} size={18} />}
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Theme</Text>
              <Text style={styles.rowValue}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            </View>
            {/* Theme toggle switch */}
            <View style={styles.themeToggle}>
              <Pressable
                style={[styles.themeBtn, !isDark && styles.themeBtnActive]}
                onPress={() => !isDark ? null : toggleTheme()}
              >
                <Sun color={!isDark ? '#fff' : COLORS.textSecondary} size={16} />
              </Pressable>
              <Pressable
                style={[styles.themeBtn, isDark && styles.themeBtnActive]}
                onPress={() => isDark ? null : toggleTheme()}
              >
                <Moon color={isDark ? '#fff' : COLORS.textSecondary} size={16} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Financial */}
        <SectionHeader title="Financial" />
        <View style={styles.card}>
          <SettingRow
            icon={Building2}
            label="Bank Accounts"
            value="Manage accounts & balances"
            onPress={() => navigation.navigate('Accounts')}
          />
          {madhab === 'shia' && (
            <SettingRow
              icon={Landmark}
              label="Khums"
              value="Annual surplus tax calculator"
              color="#7c3aed"
              onPress={() => navigation.navigate('Khums')}
            />
          )}
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <SettingRow
            icon={Shield}
            label="Email Address"
            value={email}
            onPress={null}
            rightElement={<View />}
          />
        </View>

        {/* App info */}
        <SectionHeader title="About" />
        <View style={styles.card}>
          <SettingRow
            icon={Info}
            label="App Version"
            value="2.0.0"
            onPress={null}
            rightElement={<View />}
          />
          <SettingRow
            icon={Info}
            label="About App"
            onPress={() => navigation.navigate('About')}
          />
        </View>

        {/* Sign out */}
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.7 }]}
          onPress={handleSignOut}
        >
          <LogOut color="#f44336" size={20} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    padding: SIZES.padding,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 8,
  },
  menuBtn: {
    marginRight: 16,
    padding: 8,
    backgroundColor: COLORS.card,
    borderRadius: 12,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 28,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
  },
  profileName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  sectionHeader: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  rowValue: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  pickerRowActive: {
    backgroundColor: COLORS.primary + '18',
  },
  pickerCode: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    width: 44,
  },
  pickerLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  pickerSymbol: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  themeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 3,
    gap: 2,
  },
  themeBtn: {
    width: 36,
    height: 30,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeBtnActive: {
    backgroundColor: COLORS.primary,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: 'rgba(244,67,54,0.1)',
    borderRadius: 18,
    marginTop: 8,
  },
  signOutText: {
    color: '#f44336',
    fontSize: 15,
    fontWeight: '700',
  },
});
