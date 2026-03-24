import { StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

export default StyleSheet.create({
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
    fontSize: 14,
  },
  userName: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  iconButton: {
    padding: 8,
    backgroundColor: COLORS.card,
    borderRadius: 12,
  },
  balanceCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 32,
    marginBottom: 24,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginBottom: 8,
  },
  balanceAmount: {
    color: COLORS.text,
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  transactionMethod: {
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.card,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});
