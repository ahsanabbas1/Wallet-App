import { StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: 40,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  netWorthCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  netWorthLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  netWorthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  netWorthAmount: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: 'bold',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  trendText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: 'bold',
  },
  netWorthSub: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  allocationCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
    gap: 16,
  },
  allocationItem: {
    gap: 8,
  },
  allocationTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  allocationLabel: {
    color: COLORS.text,
    fontSize: 14,
  },
  allocationPercent: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  allocationBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
  },
  allocationBar: {
    height: '100%',
    borderRadius: 4,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  toolCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  toolIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  toolTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  toolSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'center',
  },
  connectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  connectIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectText: {
    flex: 1,
  },
  connectTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  connectSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});
