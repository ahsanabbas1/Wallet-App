import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { Target, Plus, Menu, Pencil, Trash2 } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDrawer } from '../../context/DrawerContext';
import { supabase } from '../../lib/supabase';
import styles from './styles';

const SavingsGoals = () => {
  const navigation = useNavigation();
  const { openDrawer } = useDrawer();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error('Error fetching savings goals:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchGoals();
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            style={[styles.iconButton, { marginRight: 16 }]}
            onPress={openDrawer}
          >
            <Menu color={COLORS.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Savings Goals</Text>
        </View>
        <TouchableOpacity style={styles.iconButton}>
          <Plus color={COLORS.text} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : goals.length > 0 ? (
          goals.map((goal) => {
            const percent = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
            return (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={styles.goalIconContainer}>
                    <Target color={COLORS.accent} size={24} />
                  </View>
                  <View style={styles.goalInfo}>
                    <Text style={styles.goalTitle}>{goal.name}</Text>
                    <Text style={styles.goalAmount}>PKR {parseFloat(goal.current_amount).toLocaleString()} / PKR {parseFloat(goal.target_amount).toLocaleString()}</Text>
                  </View>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(percent, 100)}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{percent.toFixed(1)}%</Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Target color={COLORS.textSecondary} size={48} style={{ marginBottom: 16 }} />
            <Text style={styles.emptyStateTitle}>No Goals Yet</Text>
            <Text style={styles.emptyStateText}>Set a saving goal to track your progress.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SavingsGoals;
