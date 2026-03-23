import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../constants/theme';
import { Wallet, TrendingUp, Target, Plus, Utensils, Zap, Car, Plane } from 'lucide-react-native';

const Budgeting = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>July Budget</Text>
        
        {/* Remaining Balance Card */}
        <View style={styles.remainingCard}>
          <Text style={styles.remainingLabel}>Remaining Balance</Text>
          <Text style={styles.remainingAmount}>$600.00</Text>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: '80%' }]} />
          </View>
          <Text style={styles.progressText}>You've used 80% of your monthly budget.</Text>
        </View>

        {/* Category Budgets */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Category Budgets</Text>
          <TouchableOpacity>
            <Plus color={COLORS.primary} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.budgetList}>
          <BudgetItem 
            icon={Utensils} 
            title="Dining Out" 
            used={450} 
            total={500} 
            color="#FF5722"
          />
          <BudgetItem 
            icon={Zap} 
            title="Utilities" 
            used={120} 
            total={150} 
            color="#FFC107"
          />
          <BudgetItem 
            icon={Car} 
            title="Transport" 
            used={85} 
            total={200} 
            color="#03A9F4"
          />
        </View>

        {/* Savings Goals */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Savings Goals</Text>
          <TouchableOpacity>
            <Plus color={COLORS.primary} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.goalsList}>
          <GoalItem 
            icon={Car} 
            title="New Car" 
            saved={15000} 
            goal={20000} 
            color={COLORS.primary}
          />
          <GoalItem 
            icon={Wallet} 
            title="Emergency Fund" 
            saved={4000} 
            goal={10000} 
            color={COLORS.accent}
          />
          <GoalItem 
            icon={Plane} 
            title="Europe Trip" 
            saved={500} 
            goal={5000} 
            color="#9C27B0"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const BudgetItem = ({ icon: Icon, title, used, total, color }) => {
  const progress = (used / total) * 100;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Icon color={color} size={20} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardValue}>${used} of ${total} used</Text>
        </View>
      </View>
      <View style={styles.miniProgressContainer}>
        <View style={[styles.miniProgressBar, { width: `${progress}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const GoalItem = ({ icon: Icon, title, saved, goal, color }) => {
  const progress = (saved / goal) * 100;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Icon color={color} size={20} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardValue}>${saved.toLocaleString()} / ${goal.toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.miniProgressContainer}>
        <View style={[styles.miniProgressBar, { width: `${progress}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
  remainingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  remainingLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  remainingAmount: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  progressContainer: {
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  progressText: {
    color: COLORS.textSecondary,
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  budgetList: {
    marginBottom: 32,
    gap: 12,
  },
  goalsList: {
    gap: 12,
    marginBottom: 32,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardValue: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  miniProgressContainer: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
});

export default Budgeting;
