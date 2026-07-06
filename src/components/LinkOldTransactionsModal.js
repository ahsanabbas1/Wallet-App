import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { Database, Plus, CheckCircle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { accountService } from '../services/accountService';
import { getDb, generateId } from '../lib/db';

const LinkOldTransactionsModal = ({ visible, onClose, userId }) => {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [createLegacy, setCreateLegacy] = useState(false);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setCreateLegacy(false);
      setSelectedId(null);
      try {
        const db = getDb();
        const row = await db.getFirstAsync(
          'SELECT COUNT(*) as c FROM transactions WHERE user_id = ? AND account_id IS NULL',
          [userId]
        );
        if (!cancelled) setCount(row?.c || 0);
        const accts = await accountService.getAccounts(userId);
        if (!cancelled) setAccounts(accts || []);
      } catch {}
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [visible, userId]);

  const handleMigrate = async () => {
    if (!count) return;
    setMigrating(true);
    try {
      const db = getDb();
      let targetId = selectedId;

      if (createLegacy) {
        targetId = generateId();
        await db.runAsync(
          `INSERT INTO accounts (id, user_id, account_name, account_type, balance, color, icon, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [targetId, userId, 'Legacy', 'savings', 0, '#6b7280', 'Archive', 1, new Date().toISOString()]
        );
      }

      if (targetId) {
        await db.runAsync(
          'UPDATE transactions SET account_id = ? WHERE user_id = ? AND account_id IS NULL',
          [targetId, userId]
        );
        onClose(true);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to link transactions: ' + (e.message || 'Unknown error'));
    }
    setMigrating(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onClose(false)}>
      <Pressable style={styles.overlay} onPress={() => onClose(false)}>
        <Pressable style={[styles.sheet, { backgroundColor: COLORS.card }]} onPress={() => {}}>
          <View style={[styles.handleBar, { backgroundColor: COLORS.textSecondary }]} />

          <Text style={[styles.title, { color: COLORS.text }]}>Link Old Transactions</Text>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : count === 0 ? (
            <View style={styles.center}>
              <Database color={COLORS.success} size={40} />
              <Text style={[styles.emptyText, { color: COLORS.text }]}>All transactions are already linked to an account.</Text>
              <Pressable
                style={[styles.btn, { backgroundColor: COLORS.primary }]}
                onPress={() => onClose(false)}
              >
                <Text style={styles.btnText}>Got it</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={[styles.infoBox, { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary + '30' }]}>
                <Text style={[styles.infoText, { color: COLORS.text }]}>
                  Found <Text style={{ fontWeight: '700' }}>{count}</Text> transaction{count !== 1 ? 's' : ''} without an account.
                  Link them to an account so they appear in account views and contribute to your full financial picture.
                </Text>
              </View>

              <Text style={[styles.sectionLabel, { color: COLORS.textSecondary }]}>Select an account:</Text>

              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {/* Create Legacy Account option */}
                <Pressable
                  style={[styles.optionRow, createLegacy && { backgroundColor: COLORS.primary + '15' }]}
                  onPress={() => { setCreateLegacy(true); setSelectedId(null); }}
                >
                  <View style={[styles.radio, { borderColor: COLORS.primary }]}>
                    {createLegacy && <View style={[styles.radioFill, { backgroundColor: COLORS.primary }]} />}
                  </View>
                  <View style={[styles.optionIcon, { backgroundColor: COLORS.primary + '22' }]}>
                    <Plus color={COLORS.primary} size={18} />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionLabel, { color: COLORS.text }]}>Create "Legacy" account</Text>
                    <Text style={[styles.optionHint, { color: COLORS.textSecondary }]}>
                      Auto-creates a new account for old unlinked transactions
                    </Text>
                  </View>
                  {createLegacy && <CheckCircle color={COLORS.primary} size={20} />}
                </Pressable>

                {/* Existing accounts */}
                {accounts.map(acc => (
                  <Pressable
                    key={acc.id}
                    style={[styles.optionRow, selectedId === acc.id && { backgroundColor: COLORS.primary + '15' }]}
                    onPress={() => { setSelectedId(acc.id); setCreateLegacy(false); }}
                  >
                    <View style={[styles.radio, { borderColor: COLORS.primary }]}>
                      {selectedId === acc.id && <View style={[styles.radioFill, { backgroundColor: COLORS.primary }]} />}
                    </View>
                    <View style={[styles.optionIcon, { backgroundColor: (acc.color || COLORS.primary) + '22' }]}>
                      <Database color={acc.color || COLORS.primary} size={18} />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionLabel, { color: COLORS.text }]}>{acc.account_name}</Text>
                      <Text style={[styles.optionHint, { color: COLORS.textSecondary }]}>
                        {acc.account_type} — Balance: {acc.balance?.toLocaleString() || '0'}
                      </Text>
                    </View>
                    {selectedId === acc.id && <CheckCircle color={COLORS.primary} size={20} />}
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.actions}>
                <Pressable
                  style={[styles.btn, styles.btnOutline, { borderColor: COLORS.border }]}
                  onPress={() => onClose(false)}
                >
                  <Text style={[styles.btnTextOutline, { color: COLORS.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.btn,
                    { backgroundColor: COLORS.primary },
                    (!selectedId && !createLegacy) && { opacity: 0.4 },
                  ]}
                  onPress={handleMigrate}
                  disabled={(!selectedId && !createLegacy) || migrating}
                >
                  {migrating ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.btnText}>Link {count} Transaction{count !== 1 ? 's' : ''}</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (COLORS) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
    opacity: 0.4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  center: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 19,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  list: {
    maxHeight: 300,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 12,
    marginBottom: 6,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionHint: {
    fontSize: 11,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  btnTextOutline: {
    fontWeight: '600',
    fontSize: 15,
  },
});

export default LinkOldTransactionsModal;
