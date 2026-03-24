import { StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SIZES.padding,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  iconButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: COLORS.card,
  },
  budgetCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  budgetIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  budgetDate: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  budgetAmount: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  budgetTotal: {
    fontSize: 16,
    fontWeight: 'normal',
    color: 'rgba(255,255,255,0.7)',
  },
  progressContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.text,
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.primary + '15',
    borderRadius: 12,
  },
  inviteText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  contributorsList: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 32,
    gap: 16,
  },
  contributorItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  contributorInfo: {
    flex: 1,
  },
  contributorName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  contributorRole: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  activityList: {
    gap: 16,
    marginBottom: 40,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 16,
    gap: 16,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityDetails: {
    flex: 1,
  },
  activityText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: 'bold',
  },
  activityTime: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
});
