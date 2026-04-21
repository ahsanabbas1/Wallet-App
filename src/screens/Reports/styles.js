import { StyleSheet, Dimensions } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SIZES.padding,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  summaryAmount: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: 'bold',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  trendText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: 'bold',
  },
  comparisonText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  breakdownContainer: {
    gap: 20,
    marginBottom: 40,
  },
  breakdownItem: {
    gap: 8,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    color: COLORS.text,
    fontSize: 14,
  },
  breakdownAmount: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressIndicator: {
    height: '100%',
    borderRadius: 3,
  },
  chartContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
  },
  barChart: {
    height: 150,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barContainer: {
    alignItems: 'center',
    width: (width - 100) / 7,
  },
  bar: {
    width: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 5,
    marginBottom: 8,
  },
  activeBar: {
    backgroundColor: COLORS.primary,
  },
  barLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  activeBarLabel: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  insightsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    marginBottom: 20,
  },
  insightsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsTextContainer: {
    flex: 1,
  },
  insightsTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  insightsBody: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    paddingHorizontal: SIZES.padding,
    justifyContent: 'space-between',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
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
    color: COLORS.text,
  },
  recommendationsSection: {
    marginBottom: 32,
  },
  recommendationCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  recommendationTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  recommendationText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  savingsAmount: {
    color: COLORS.success || '#4caf50',
    fontSize: 13,
    fontWeight: '600',
  },
  expandedInsights: {
    gap: 8,
    marginBottom: 8,
  },
  insightItem: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
});
