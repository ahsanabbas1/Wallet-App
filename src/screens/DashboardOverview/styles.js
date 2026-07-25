import { StyleSheet } from 'react-native';
import { SIZES, SPACING, RADIUS, TYPOGRAPHY } from '../../constants/theme';

export const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.caption.fontSize,
  },
  userName: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.heading.fontSize,
    fontWeight: TYPOGRAPHY.heading.fontWeight,
  },
  iconButton: {
    padding: 7,
    backgroundColor: COLORS.glass,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  statRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.title.fontSize,
    fontWeight: TYPOGRAPHY.title.fontWeight,
    marginBottom: 16,
  },
  quickActions: {
    marginBottom: 24,
  },
  actionItem: {
    alignItems: 'center',
    marginRight: 24,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: COLORS.isDark ? 0.15 : 0.08,
    shadowRadius: 8,
  },
  actionText: {
    color: COLORS.text,
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    color: COLORS.accent,
    fontSize: 14,
  },
  transactionsList: {
    gap: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.glass,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: COLORS.isDark ? 0.1 : 0.06,
    shadowRadius: 8,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  transactionMethod: {
    color: COLORS.textTertiary,
    fontSize: 10,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  pencilIcon: {
    marginLeft: 12,
    padding: 4,
  },
  actionButtons: {
    marginLeft: 12,
    gap: 8,
    alignItems: 'center',
  },
  deleteIcon: {
    padding: 4,
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptyState: {
    padding: 24,
    backgroundColor: COLORS.glass,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  emptyStateText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});
