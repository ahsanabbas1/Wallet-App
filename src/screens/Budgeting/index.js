import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { Wallet, TrendingUp, Target, Plus, Utensils, Zap, Car, Plane } from 'lucide-react-native';
import { styles } from './styles';

const Budgeting = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>July Budget</Text>
        
        {/* Remaining Balance Card */}
        <View style={styles.remainingCard}>
          <Text style={styles.remainingLabel}>Remaining Balance</Text>
          <Text style={styles.remainingAmount}>PKR 600.00</Text>
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
          <Text style={styles.cardValue}>PKR {used} of PKR {total} used</Text>
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
          <Text style={styles.cardValue}>PKR {saved.toLocaleString()} / PKR {goal.toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.miniProgressContainer}>
        <View style={[styles.miniProgressBar, { width: `${progress}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

export default Budgeting;
