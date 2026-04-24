import { StyleSheet, Dimensions } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({

  /* ── Container ─────────────────────────────────────────────────────── */
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  /* ── Header ────────────────────────────────────────────────────────── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingTop: 16,
    paddingBottom: 12,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  calendarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarBtnActive: {
    backgroundColor: COLORS.primary,
  },

  /* ── Filter pills ──────────────────────────────────────────────────── */
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    gap: 8,
    marginBottom: 4,
  },
  filterPills: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  /* ── Range badge ───────────────────────────────────────────────────── */
  rangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '20',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: SIZES.padding,
    marginTop: 10,
    gap: 6,
    alignSelf: 'flex-start',
  },
  rangeBadgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  rangeBadgeClear: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Hero card ─────────────────────────────────────────────────────── */
  heroCard: {
    marginHorizontal: SIZES.padding,
    marginTop: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  heroPeriod: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroAmount: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 4,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 20,
  },
  heroTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
  },
  heroTrendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  heroTrendText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroTrendLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
  },
  heroStatsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 16,
    gap: 0,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 2,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  /* ── Tab bar ───────────────────────────────────────────────────────── */
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: SIZES.padding,
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 4,
    gap: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },

  /* ── Section headers ───────────────────────────────────────────────── */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },

  /* ── Chart card wrapper ────────────────────────────────────────────── */
  chartCard: {
    marginHorizontal: SIZES.padding,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  chartCardTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 14,
  },

  /* ── Category breakdown (Overview tab) ────────────────────────────── */
  breakdownCard: {
    marginHorizontal: SIZES.padding,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  breakdownRow: {
    marginBottom: 14,
  },
  breakdownMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  catDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  catName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  catVariance: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 2,
  },
  catVarianceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  catAmount: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  /* ── Insight card ──────────────────────────────────────────────────── */
  insightCard: {
    marginHorizontal: SIZES.padding,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  insightIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  insightItem: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },

  /* ── Alert / Recommendation cards ─────────────────────────────────── */
  alertCard: {
    marginHorizontal: SIZES.padding,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  alertIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  alertTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  alertBody: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  alertValue: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Analytics tab mini kpi row ────────────────────────────────────── */
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
  },
  kpiLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  kpiChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  kpiChangeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* ── Inline bar chart (6-month) ────────────────────────────────────── */
  inlineBarChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 70,
    gap: 4,
  },
  inlineBarWrap: {
    flex: 1,
    alignItems: 'center',
    height: 70,
    justifyContent: 'flex-end',
  },
  inlineBar: {
    width: '70%',
    borderRadius: 4,
    marginBottom: 4,
  },
  inlineBarLabel: {
    color: COLORS.textSecondary,
    fontSize: 9,
  },
  inlineBarLabelActive: {
    color: COLORS.text,
    fontWeight: '700',
  },

  /* ── Book tab (ledger) ─────────────────────────────────────────────── */
  bookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    marginBottom: 14,
  },
  ledgerToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  toggleBtn: {
    padding: 7,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  ledgerContainer: {
    paddingHorizontal: SIZES.padding,
  },

  /* ── Date picker modal ─────────────────────────────────────────────── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  datePickerSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  dateTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  dateTabActive: {
    backgroundColor: COLORS.primary,
  },
  dateTabLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateTabLabelActive: { color: '#fff' },
  dateTabValue: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  dateTabValueActive: { color: 'rgba(255,255,255,0.8)' },
  applyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  applyBtnDisabled: { opacity: 0.35 },
  applyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* ── Empty state ───────────────────────────────────────────────────── */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
  },
});
