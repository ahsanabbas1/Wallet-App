import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Calendar, Menu, Info } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useDrawer } from '../../context/DrawerContext';
import { SIZES } from '../../constants/theme';
import paymentService from '../../services/paymentService';
import { savingsGoalService } from '../../services/savingsGoalService';
import { shoppingService } from '../../services/shoppingService';

const EVENT_COLORS = {
  payment: '#4f5ff7',
  goal:    '#22c55e',
  warranty:'#f97316',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const toYMD = (dateStr) => {
  if (!dateStr) return null;
  return dateStr.split('T')[0];
};

export default function FinancialCalendar() {
  const { colors: COLORS } = useTheme();
  const { userId } = useAuth();
  const { toggleDrawer } = useDrawer();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [events, setEvents] = useState({}); // { 'YYYY-MM-DD': [{ type, label, color }] }
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [payments, goalsResult, warranties] = await Promise.all([
        paymentService.getPlannedPayments(userId),
        savingsGoalService.getSavingsGoals(userId),
        shoppingService.getWarranties(userId),
      ]);
      const goals = goalsResult?.data || goalsResult || [];

      const map = {};

      const push = (dateStr, entry) => {
        if (!dateStr) return;
        const key = toYMD(dateStr);
        if (!key) return;
        if (!map[key]) map[key] = [];
        map[key].push(entry);
      };

      (payments || []).forEach(p => {
        if (p.is_active !== 0) {
          push(p.next_date, { type: 'payment', label: p.title, color: EVENT_COLORS.payment });
        }
      });

      (goals || []).forEach(g => {
        push(g.target_date, { type: 'goal', label: g.name || g.title, color: EVENT_COLORS.goal });
      });

      (warranties || []).forEach(w => {
        push(w.expiry_date, { type: 'warranty', label: w.name, color: EVENT_COLORS.warranty });
      });

      setEvents(map);
    } catch (e) {
      console.warn('FinancialCalendar load error:', e);
    }
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { loadEvents(); }, [loadEvents]));

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelected(null);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelected(null);
  };

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayYMD = toYMD(today.toISOString());

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const formatKey = (d) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const selectedKey = selected ? formatKey(selected) : null;
  const selectedEvents = selectedKey ? (events[selectedKey] || []) : [];

  const showPageInfo = () => Alert.alert(
    'Financial Calendar',
    'View all your upcoming financial events — planned payments, savings goal deadlines, and warranty expirations — on a single monthly calendar. Tap any day to see its events.',
  );

  const eventTypeLabel = (type) => {
    if (type === 'payment') return 'Payment';
    if (type === 'goal')    return 'Savings Goal';
    return 'Warranty';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={toggleDrawer} style={styles.menuBtn} hitSlop={8}>
          <Menu color={COLORS.text} size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Financial Calendar</Text>
        <Pressable onPress={showPageInfo} style={styles.menuBtn} hitSlop={8}>
          <Info color={COLORS.textSecondary} size={20} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <Pressable onPress={prevMonth} style={styles.navBtn} hitSlop={8}>
              <ChevronLeft color={COLORS.text} size={22} />
            </Pressable>
            <Text style={styles.monthTitle}>{MONTH_NAMES[month]} {year}</Text>
            <Pressable onPress={nextMonth} style={styles.navBtn} hitSlop={8}>
              <ChevronRight color={COLORS.text} size={22} />
            </Pressable>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {Object.entries(EVENT_COLORS).map(([type, color]) => (
              <View key={type} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{eventTypeLabel(type)}</Text>
              </View>
            ))}
          </View>

          {/* Day headers */}
          <View style={styles.dayNamesRow}>
            {DAY_NAMES.map(d => (
              <Text key={d} style={styles.dayName}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={`e-${i}`} style={styles.cell} />;
              const key = formatKey(d);
              const dayEvents = events[key] || [];
              const isToday = key === todayYMD;
              const isSelected = selected === d;
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.cell,
                    isToday    && styles.cellToday,
                    isSelected && styles.cellSelected,
                  ]}
                  onPress={() => setSelected(isSelected ? null : d)}
                >
                  <Text style={[
                    styles.dayNum,
                    isToday    && styles.dayNumToday,
                    isSelected && styles.dayNumSelected,
                  ]}>{d}</Text>
                  {dayEvents.length > 0 && (
                    <View style={styles.dotRow}>
                      {dayEvents.slice(0, 3).map((ev, idx) => (
                        <View key={idx} style={[styles.eventDot, { backgroundColor: ev.color }]} />
                      ))}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Selected day events */}
          {selected && (
            <View style={styles.eventList}>
              <Text style={styles.eventListTitle}>
                {MONTH_NAMES[month]} {selected}, {year}
              </Text>
              {selectedEvents.length === 0 ? (
                <Text style={styles.noEvents}>No events on this day</Text>
              ) : (
                selectedEvents.map((ev, i) => (
                  <View key={i} style={styles.eventCard}>
                    <View style={[styles.eventAccent, { backgroundColor: ev.color }]} />
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventLabel}>{ev.label}</Text>
                      <Text style={[styles.eventType, { color: ev.color }]}>{eventTypeLabel(ev.type)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    padding: SIZES.padding,
    paddingBottom: 40,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: COLORS.card,
  },
  monthTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayName: {
    width: '14.28%',
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    paddingBottom: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    aspectRatio: 0.9,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
    borderRadius: 8,
  },
  cellToday: {
    backgroundColor: `${COLORS.primary}22`,
  },
  cellSelected: {
    backgroundColor: COLORS.primary,
  },
  dayNum: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  dayNumToday: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  dayNumSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 3,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  eventList: {
    marginTop: 24,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SIZES.padding,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eventListTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  noEvents: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  eventAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  eventInfo: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  eventLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  eventType: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
});
