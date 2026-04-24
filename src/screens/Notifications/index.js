import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, Switch,
  ActivityIndicator, Alert, StyleSheet, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Menu, Bell, BellOff, Check, CheckCheck, Trash2,
  CalendarClock, PieChart, Target, TrendingUp,
  AlertTriangle, AlertOctagon, ArrowUpRight, Clock,
  ChevronDown, ChevronUp, Settings,
} from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth }   from '../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import {
  NOTIFICATION_TYPES, NOTIFICATION_META, DEFAULT_PREFERENCES,
  getNotifications, getPreferences, savePreferences,
  markAsRead, markAllAsRead, deleteNotification, clearAllNotifications,
  generateNotifications,
} from '../../services/notificationService';

/* ─── Icon map ───────────────────────────────────────────────────────────── */

const TYPE_ICONS = {
  [NOTIFICATION_TYPES.PAYMENT_DUE]:       CalendarClock,
  [NOTIFICATION_TYPES.BUDGET_WARNING]:    PieChart,
  [NOTIFICATION_TYPES.BUDGET_EXCEEDED]:   AlertTriangle,
  [NOTIFICATION_TYPES.GOAL_MILESTONE]:    Target,
  [NOTIFICATION_TYPES.GOAL_DEADLINE]:     Clock,
  [NOTIFICATION_TYPES.SPENDING_SPIKE]:    TrendingUp,
  [NOTIFICATION_TYPES.NEGATIVE_BALANCE]:  AlertOctagon,
  [NOTIFICATION_TYPES.LARGE_TRANSACTION]: ArrowUpRight,
};

/* ─── Relative time formatter ────────────────────────────────────────────── */

const relativeTime = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return 'Just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
};

/* ─── Preference control builders ───────────────────────────────────────── */

const DAYS_OPTIONS    = [1, 2, 3, 7];
const PCT_OPTIONS     = [50, 70, 80, 90];
const SPIKE_OPTIONS   = [20, 30, 50];
const AMOUNT_OPTIONS  = [5000, 10000, 25000, 50000];

/* ════════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ════════════════════════════════════════════════════════════════════════════ */

export default function Notifications() {
  const { openDrawer } = useDrawer();
  const { userId }     = useAuth();

  const [activeTab,    setActiveTab]    = useState(0); // 0 = Inbox, 1 = Settings
  const [loading,      setLoading]      = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [prefs,        setPrefs]        = useState(DEFAULT_PREFERENCES);
  const [saving,       setSaving]       = useState(false);
  const [expandedPref, setExpandedPref] = useState(null);

  /* ── Load ──────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await generateNotifications(userId);
      const [notifs, userPrefs] = await Promise.all([
        getNotifications(userId),
        getPreferences(userId),
      ]);
      setNotifications(notifs);
      setPrefs(userPrefs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /* ── Inbox actions ─────────────────────────────────────────────────── */
  const handleRead = async (id) => {
    await markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteNotification(id);
          setNotifications(prev => prev.filter(n => n.id !== id));
        },
      },
    ]);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClearAll = () => {
    Alert.alert('Clear All', 'Delete all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All', style: 'destructive',
        onPress: async () => {
          await clearAllNotifications(userId);
          setNotifications([]);
        },
      },
    ]);
  };

  /* ── Preferences ───────────────────────────────────────────────────── */
  const updatePref = (type, key, value) => {
    setPrefs(prev => ({ ...prev, [type]: { ...prev[type], [key]: value } }));
  };

  const handleSavePrefs = async () => {
    setSaving(true);
    await savePreferences(userId, prefs);
    setSaving(false);
    Alert.alert('Saved', 'Notification preferences updated.');
  };

  /* ── Derived ────────────────────────────────────────────────────────── */
  const unread = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={s.container}>

      {/* Header */}
      <View style={s.header}>
        <Pressable style={({ pressed }) => [s.menuBtn, pressed && { opacity: 0.7 }]} onPress={openDrawer}>
          <Menu color={COLORS.text} size={22} />
        </Pressable>
        <Text style={s.headerTitle}>Notifications</Text>
        {unread > 0 && <View style={s.badge}><Text style={s.badgeText}>{unread}</Text></View>}
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        <Pressable style={[s.tab, activeTab === 0 && s.tabActive]} onPress={() => setActiveTab(0)}>
          <Bell color={activeTab === 0 ? COLORS.primary : COLORS.textSecondary} size={16} />
          <Text style={[s.tabText, activeTab === 0 && s.tabTextActive]}>Inbox</Text>
          {unread > 0 && <View style={s.tabBadge}><Text style={s.tabBadgeText}>{unread}</Text></View>}
        </Pressable>
        <Pressable style={[s.tab, activeTab === 1 && s.tabActive]} onPress={() => setActiveTab(1)}>
          <Settings color={activeTab === 1 ? COLORS.primary : COLORS.textSecondary} size={16} />
          <Text style={[s.tabText, activeTab === 1 && s.tabTextActive]}>Preferences</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <>
          {/* ── INBOX TAB ─────────────────────────────────────────── */}
          {activeTab === 0 && (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              {/* Action row */}
              {notifications.length > 0 && (
                <View style={s.inboxActions}>
                  {unread > 0 && (
                    <Pressable style={s.actionBtn} onPress={handleMarkAllRead}>
                      <CheckCheck color={COLORS.primary} size={15} />
                      <Text style={s.actionBtnText}>Mark all read</Text>
                    </Pressable>
                  )}
                  <Pressable style={[s.actionBtn, { marginLeft: 'auto' }]} onPress={handleClearAll}>
                    <Trash2 color={COLORS.error} size={15} />
                    <Text style={[s.actionBtnText, { color: COLORS.error }]}>Clear all</Text>
                  </Pressable>
                </View>
              )}

              {notifications.length === 0 ? (
                <View style={s.emptyState}>
                  <BellOff color={COLORS.textSecondary} size={48} />
                  <Text style={s.emptyTitle}>No notifications yet</Text>
                  <Text style={s.emptyBody}>
                    Notifications will appear here when there are budget alerts, payment reminders, or savings milestones.
                  </Text>
                </View>
              ) : (
                notifications.map(n => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onRead={handleRead}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </ScrollView>
          )}

          {/* ── PREFERENCES TAB ────────────────────────────────────── */}
          {activeTab === 1 && (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              <Text style={s.prefHint}>
                Configure which alerts you want and when to receive them. Changes are saved when you tap "Save Preferences".
              </Text>

              {Object.keys(NOTIFICATION_TYPES).map((key) => {
                const type  = NOTIFICATION_TYPES[key];
                const meta  = NOTIFICATION_META[type];
                const pref  = prefs[type] || DEFAULT_PREFERENCES[type];
                const Icon  = TYPE_ICONS[type];
                const open  = expandedPref === type;

                return (
                  <View key={type} style={s.prefCard}>
                    {/* Row header */}
                    <Pressable
                      style={s.prefRow}
                      onPress={() => setExpandedPref(open ? null : type)}
                    >
                      <View style={[s.prefIcon, { backgroundColor: meta.color + '20' }]}>
                        <Icon color={meta.color} size={18} />
                      </View>
                      <View style={s.prefLabelWrap}>
                        <Text style={s.prefLabel}>{meta.label}</Text>
                        <Text style={s.prefStatus}>{pref.enabled ? 'On' : 'Off'}</Text>
                      </View>
                      <Switch
                        value={!!pref.enabled}
                        onValueChange={v => updatePref(type, 'enabled', v)}
                        trackColor={{ false: 'rgba(255,255,255,0.1)', true: meta.color + '80' }}
                        thumbColor={pref.enabled ? meta.color : COLORS.textSecondary}
                      />
                      {open
                        ? <ChevronUp   color={COLORS.textSecondary} size={16} style={{ marginLeft: 6 }} />
                        : <ChevronDown color={COLORS.textSecondary} size={16} style={{ marginLeft: 6 }} />}
                    </Pressable>

                    {/* Expanded settings */}
                    {open && pref.enabled && (
                      <View style={s.prefExpanded}>
                        {/* Days before (payment_due, goal_deadline) */}
                        {('daysBefore' in (DEFAULT_PREFERENCES[type] || {})) && (
                          <OptionChips
                            label="Alert days before due"
                            options={DAYS_OPTIONS}
                            selected={pref.daysBefore}
                            fmt={v => `${v}d`}
                            color={meta.color}
                            onSelect={v => updatePref(type, 'daysBefore', v)}
                          />
                        )}

                        {/* Threshold % (budget_warning, spending_spike) */}
                        {'threshold' in (DEFAULT_PREFERENCES[type] || {}) && type === NOTIFICATION_TYPES.BUDGET_WARNING && (
                          <OptionChips
                            label="Alert when budget reaches"
                            options={PCT_OPTIONS}
                            selected={pref.threshold}
                            fmt={v => `${v}%`}
                            color={meta.color}
                            onSelect={v => updatePref(type, 'threshold', v)}
                          />
                        )}

                        {/* Threshold % (spending_spike) */}
                        {type === NOTIFICATION_TYPES.SPENDING_SPIKE && (
                          <OptionChips
                            label="Alert when spending increases by"
                            options={SPIKE_OPTIONS}
                            selected={pref.threshold}
                            fmt={v => `${v}%`}
                            color={meta.color}
                            onSelect={v => updatePref(type, 'threshold', v)}
                          />
                        )}

                        {/* Amount threshold (large_transaction) */}
                        {type === NOTIFICATION_TYPES.LARGE_TRANSACTION && (
                          <OptionChips
                            label="Alert when a single expense exceeds"
                            options={AMOUNT_OPTIONS}
                            selected={pref.thresholdAmount}
                            fmt={v => `PKR ${(v / 1000).toFixed(0)}k`}
                            color={meta.color}
                            onSelect={v => updatePref(type, 'thresholdAmount', v)}
                          />
                        )}

                        {/* Milestones (goal_milestone) */}
                        {type === NOTIFICATION_TYPES.GOAL_MILESTONE && (
                          <View>
                            <Text style={s.optLabel}>Alert at milestones</Text>
                            <View style={s.chipRow}>
                              {[25, 50, 75, 100].map(m => {
                                const active = (pref.milestones || []).includes(m);
                                return (
                                  <Pressable
                                    key={m}
                                    style={[s.chip, active && { backgroundColor: meta.color }]}
                                    onPress={() => {
                                      const current = pref.milestones || [];
                                      updatePref(type, 'milestones',
                                        active ? current.filter(x => x !== m) : [...current, m].sort((a, b) => a - b)
                                      );
                                    }}
                                  >
                                    <Text style={[s.chipText, active && { color: '#fff', fontWeight: '700' }]}>
                                      {m}%
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Save button */}
              <Pressable
                style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.75 }, saving && { opacity: 0.5 }]}
                onPress={handleSavePrefs}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Check color="#fff" size={18} /><Text style={s.saveBtnText}>Save Preferences</Text></>}
              </Pressable>

              <View style={{ height: 24 }} />
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

/* ─── NotificationCard ───────────────────────────────────────────────────── */

function NotificationCard({ notification: n, onRead, onDelete }) {
  const meta = NOTIFICATION_META[n.type] || { color: COLORS.primary, icon: 'Bell' };
  const Icon = TYPE_ICONS[n.type] || Bell;

  return (
    <Pressable
      style={[s.card, !n.is_read && s.cardUnread]}
      onPress={() => !n.is_read && onRead(n.id)}
    >
      <View style={[s.cardIcon, { backgroundColor: meta.color + '20' }]}>
        <Icon color={meta.color} size={20} />
        {!n.is_read && <View style={[s.cardDot, { backgroundColor: meta.color }]} />}
      </View>

      <View style={s.cardBody}>
        <View style={s.cardTitleRow}>
          <Text style={[s.cardTitle, !n.is_read && { color: '#fff' }]} numberOfLines={1}>
            {n.title}
          </Text>
          <Text style={s.cardTime}>{relativeTime(n.created_at)}</Text>
        </View>
        <Text style={s.cardText} numberOfLines={2}>{n.body}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.5 }]}
        onPress={() => onDelete(n.id)}
        hitSlop={8}
      >
        <Trash2 color="rgba(255,255,255,0.2)" size={15} />
      </Pressable>
    </Pressable>
  );
}

/* ─── OptionChips ─────────────────────────────────────────────────────────── */

function OptionChips({ label, options, selected, fmt, color, onSelect }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.optLabel}>{label}</Text>
      <View style={s.chipRow}>
        {options.map(o => {
          const active = selected === o;
          return (
            <Pressable
              key={o}
              style={[s.chip, active && { backgroundColor: color }]}
              onPress={() => onSelect(o)}
            >
              <Text style={[s.chipText, active && { color: '#fff', fontWeight: '700' }]}>
                {fmt(o)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll:    { padding: SIZES.padding, paddingTop: 8 },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingTop: 16,
    paddingBottom: 12,
  },
  menuBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1, color: COLORS.text, fontSize: 22,
    fontWeight: '800', letterSpacing: -0.3,
  },
  badge: {
    backgroundColor: COLORS.error,
    borderRadius: 10, minWidth: 20, height: 20,
    paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  /* tabs */
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: SIZES.padding,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 4, gap: 3,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 11,
  },
  tabActive: {
    backgroundColor: COLORS.card,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  tabText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: COLORS.text, fontWeight: '700' },
  tabBadge: {
    backgroundColor: COLORS.error, borderRadius: 8,
    minWidth: 16, height: 16, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  /* inbox actions */
  inboxActions: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10,
  },
  actionBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },

  /* notification card */
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: 'flex-start',
    gap: 12,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    backgroundColor: 'rgba(64,81,181,0.10)',
  },
  cardIcon: {
    width: 42, height: 42, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', flexShrink: 0,
  },
  cardDot: {
    position: 'absolute', top: 2, right: 2,
    width: 8, height: 8, borderRadius: 4,
  },
  cardBody: { flex: 1 },
  cardTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 4, gap: 8,
  },
  cardTitle: {
    color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', flex: 1,
  },
  cardTime: { color: COLORS.textSecondary, fontSize: 11, flexShrink: 0 },
  cardText:  { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  deleteBtn: { padding: 4, alignSelf: 'center' },

  /* empty */
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: {
    color: COLORS.text, fontSize: 17, fontWeight: '700', marginTop: 16, marginBottom: 8,
  },
  emptyBody: {
    color: COLORS.textSecondary, fontSize: 13,
    textAlign: 'center', lineHeight: 20,
  },

  /* preferences */
  prefHint: {
    color: COLORS.textSecondary, fontSize: 12,
    lineHeight: 18, marginBottom: 16, lineHeight: 18,
  },
  prefCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    marginBottom: 10,
    overflow: 'hidden',
  },
  prefRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  prefIcon: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  prefLabelWrap: { flex: 1 },
  prefLabel: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  prefStatus: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  prefExpanded: {
    paddingHorizontal: 14, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 12,
  },

  /* option chips */
  optLabel: {
    color: COLORS.textSecondary, fontSize: 11,
    fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  chipText: { color: COLORS.textSecondary, fontSize: 13 },

  /* save button */
  saveBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16, paddingVertical: 14,
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
