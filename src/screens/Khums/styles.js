import { StyleSheet } from 'react-native';
import { SIZES } from '../../constants/theme';

export const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  /* ── Header ─────────────────────────────────────────────────────── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  /* ── Year Selector ───────────────────────────────────────────────── */
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    gap: 8,
  },
  yearNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearLabel: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  yearLabelSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 1,
  },
  newYearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#7c3aed' + '18',
    borderWidth: 1,
    borderColor: '#7c3aed' + '44',
    gap: 4,
  },
  newYearBtnText: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Summary Card ────────────────────────────────────────────────── */
  summaryCard: {
    marginHorizontal: SIZES.padding,
    marginBottom: 12,
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  summaryKhumsLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryKhumsAmount: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 14,
  },
  summaryShareRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  summaryShareBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
  },
  summaryShareTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryShareDue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  summaryShareSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
  },
  summaryBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryMeta: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },

  /* ── Section Cards ───────────────────────────────────────────────── */
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    marginHorizontal: SIZES.padding,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#7c3aed' + '18',
  },
  sectionActionText: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Income rows ─────────────────────────────────────────────────── */
  incomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  incomeRowLast: {
    borderBottomWidth: 0,
    paddingTop: 10,
    marginTop: 4,
  },
  incomeLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  incomeValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  incomeTotalLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  incomeTotalValue: {
    color: '#7c3aed',
    fontSize: 15,
    fontWeight: '800',
  },
  incomeEditBtn: {
    padding: 4,
  },
  incomeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exemptTag: {
    backgroundColor: '#7c3aed' + '22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  exemptTagText: {
    color: '#7c3aed',
    fontSize: 9,
    fontWeight: '700',
  },

  /* ── Category chips ──────────────────────────────────────────────── */
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: '#7c3aed' + '18',
    borderColor: '#7c3aed',
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#7c3aed',
    fontWeight: '700',
  },

  /* ── Expense items ───────────────────────────────────────────────── */
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  expenseIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#7c3aed' + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseCat: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  expenseDesc: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  expenseAmount: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  expenseDeleteBtn: {
    padding: 4,
  },
  emptyExpenses: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },

  /* ── Progress bar ────────────────────────────────────────────────── */
  progressTrack: {
    height: 7,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },

  /* ── Payment section ─────────────────────────────────────────────── */
  paymentTypeBlock: {
    marginBottom: 14,
  },
  paymentTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentTypeLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  paymentTypeSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  recordPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    marginTop: 8,
  },
  recordPayBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  paymentHistoryToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  paymentHistoryTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  paymentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  paymentItemInfo: { flex: 1 },
  paymentItemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
  paymentItemSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  paymentDeleteBtn: { padding: 4 },

  /* ── Notes ──────────────────────────────────────────────────────── */
  notesInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    color: COLORS.text,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  /* ── Empty / loading ─────────────────────────────────────────────── */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#7c3aed' + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#7c3aed',
  },
  emptyCreateBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  /* ── FAB ────────────────────────────────────────────────────────── */
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },

  /* ── Modal shared ────────────────────────────────────────────────── */
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    padding: SIZES.padding,
    paddingBottom: 40,
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: COLORS.inputBg || COLORS.surface,
    borderRadius: 12,
    padding: 14,
    color: COLORS.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: '#7c3aed',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typeToggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  typeToggleBtnActive: {
    borderColor: '#7c3aed',
    backgroundColor: '#7c3aed' + '18',
  },
  typeToggleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  typeToggleBtnTextActive: {
    color: '#7c3aed',
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    gap: 10,
  },
  dateBtnText: {
    color: COLORS.text,
    fontSize: 15,
    flex: 1,
  },

  /* ── Info box ────────────────────────────────────────────────────── */
  infoBox: {
    backgroundColor: '#7c3aed' + '12',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: SIZES.padding,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#7c3aed',
  },
  infoBoxText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 18,
  },
});
