import { StyleSheet } from 'react-native';
import { SIZES } from '../../constants/theme';

export const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    backgroundColor: COLORS.card,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  scrollContent: {
    padding: SIZES.padding,
  },
  summaryContainer: {
    marginBottom: 24,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  dateText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  ledgerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  ledgerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  ledgerDetails: {
    flex: 1,
    minWidth: 0,      // allows flex child to shrink below its content size
    marginRight: 8,
  },
  ledgerTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  ledgerSub: {
    color: COLORS.textSecondary,  // was hardcoded rgba(255,255,255,0.7) — dark mode only
    fontSize: 12,
  },
  ledgerAmount: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'right',
    flexShrink: 0,
  },
  ledgerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,   // never shrink the right side; let ledgerDetails shrink instead
    gap: 8,
  },
  pencilButton: {
    padding: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: 'rgba(255,0,0,0.08)',
    borderRadius: 8,
  },
  emptyState: {
    padding: 24,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyStateText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  filterOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  filterOptionText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  filterOptionActive: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  datePickerSheet: {
    backgroundColor: COLORS.card,
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
    backgroundColor: COLORS.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
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
    backgroundColor: COLORS.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
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
});
