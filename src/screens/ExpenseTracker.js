import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../constants/theme';
import { ArrowUpRight, ArrowDownLeft, ShoppingCart, Fuel, Briefcase, Tv, Calendar, Filter, Plus } from 'lucide-react-native';

const ExpenseTracker = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Financial Ledger</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('AddTransaction')}
          >
            <Plus color={COLORS.text} size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Filter color={COLORS.text} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { backgroundColor: COLORS.card }]}>
            <View style={[styles.summaryIcon, { backgroundColor: COLORS.accent + '20' }]}>
              <ArrowUpRight color={COLORS.accent} size={24} />
            </View>
            <Text style={styles.summaryLabel}>Total Income</Text>
            <Text style={[styles.summaryAmount, { color: COLORS.accent }]}>$4,500.00</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: COLORS.card }]}>
            <View style={[styles.summaryIcon, { backgroundColor: COLORS.error + '20' }]}>
              <ArrowDownLeft color={COLORS.error} size={24} />
            </View>
            <Text style={styles.summaryLabel}>Total Expenses</Text>
            <Text style={[styles.summaryAmount, { color: COLORS.error }]}>$2,100.00</Text>
          </View>
        </View>

        {/* Transactions List */}
        <View style={styles.section}>
          <View style={styles.dateHeader}>
            <Calendar color={COLORS.textSecondary} size={16} />
            <Text style={styles.dateText}>Today, Oct 24</Text>
          </View>

          <LedgerItem 
            icon={ShoppingCart} 
            title="Grocery Store" 
            sub="Weekly shop at Central Market..." 
            amount="-$156.00" 
            color="#FF9800"
          />
          <LedgerItem 
            icon={Fuel} 
            title="Fuel Station" 
            sub="Full tank for commute" 
            amount="-$45.00" 
            color="#03A9F4"
          />
          <LedgerItem 
            icon={Briefcase} 
            title="Freelance Project" 
            sub="UI Design - Final payment" 
            amount="+$2,500.00" 
            color={COLORS.accent}
            isPositive
          />
        </View>

        <View style={styles.section}>
          <View style={styles.dateHeader}>
            <Calendar color={COLORS.textSecondary} size={16} />
            <Text style={styles.dateText}>Yesterday, Oct 23</Text>
          </View>

          <LedgerItem 
            icon={Tv} 
            title="Netflix" 
            sub="Monthly subscription fee" 
            amount="-$15.00" 
            color="#F44336"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const LedgerItem = ({ icon: Icon, title, sub, amount, color, isPositive }) => (
  <View style={styles.ledgerItem}>
    <View style={[styles.ledgerIcon, { backgroundColor: color + '20' }]}>
      <Icon color={color} size={24} />
    </View>
    <View style={styles.ledgerDetails}>
      <Text style={styles.ledgerTitle}>{title}</Text>
      <Text style={styles.ledgerSub} numberOfLines={1}>{sub}</Text>
    </View>
    <Text style={[styles.ledgerAmount, isPositive && { color: COLORS.accent }]}>
      {amount}
    </Text>
  </View>
);

const styles = StyleSheet.create({
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
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: 'flex-start',
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
    color: COLORS.textSecondary,
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
  },
  ledgerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  ledgerSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  ledgerAmount: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ExpenseTracker;
