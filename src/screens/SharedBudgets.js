import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../constants/theme';
import { Users, UserPlus, MessageCircle, Settings, ChevronRight, Plane, Utensils, CreditCard } from 'lucide-react-native';

const SharedBudgets = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Shared Budgets</Text>
          <TouchableOpacity style={styles.iconButton}>
            <Settings color={COLORS.text} size={20} />
          </TouchableOpacity>
        </View>

        {/* Shared Budget Card */}
        <View style={styles.budgetCard}>
          <View style={styles.budgetHeader}>
            <View style={styles.budgetIconContainer}>
              <Plane color={COLORS.text} size={24} />
            </View>
            <View>
              <Text style={styles.budgetName}>Family Holiday</Text>
              <Text style={styles.budgetDate}>Saving for Japan 2024</Text>
            </View>
          </View>
          
          <Text style={styles.budgetAmount}>$2,400 <Text style={styles.budgetTotal}>of $5,000</Text></Text>
          
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: '48%' }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>48% completed</Text>
            <Text style={styles.progressText}>$2,600 left</Text>
          </View>
        </View>

        {/* Contributors */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Contributors</Text>
          <TouchableOpacity style={styles.inviteButton}>
            <UserPlus color={COLORS.primary} size={18} />
            <Text style={styles.inviteText}>Invite</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contributorsList}>
          <ContributorItem name="Alex Rivera" role="Owner" isSelf />
          <ContributorItem name="Sarah Jenkins" role="Admin" />
          <ContributorItem name="Mark Thomson" role="Contributor" />
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityList}>
          <ActivityItem 
            user="Sarah J." 
            action="added $150" 
            item="Flights" 
            time="2h ago" 
            icon={Plane} 
            color="#2196F3"
          />
          <ActivityItem 
            user="Mark T." 
            action="added $45" 
            item="Dinner" 
            time="5h ago" 
            icon={Utensils} 
            color="#FF9800"
          />
          <ActivityItem 
            user="Alex R." 
            action="updated goal" 
            item="Japan Trip" 
            time="Yesterday" 
            icon={Settings} 
            color={COLORS.primary}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const ContributorItem = ({ name, role, isSelf }) => (
  <View style={styles.contributorItem}>
    <View style={[styles.avatar, isSelf && { backgroundColor: COLORS.primary }]}>
      <Text style={styles.avatarText}>{name.charAt(0)}</Text>
    </View>
    <View style={styles.contributorInfo}>
      <Text style={styles.contributorName}>{name} {isSelf && '(You)'}</Text>
      <Text style={styles.contributorRole}>{role}</Text>
    </View>
    <TouchableOpacity>
      <MessageCircle color={COLORS.textSecondary} size={20} />
    </TouchableOpacity>
  </View>
);

const ActivityItem = ({ user, action, item, time, icon: Icon, color }) => (
  <View style={styles.activityItem}>
    <View style={[styles.activityIcon, { backgroundColor: color + '20' }]}>
      <Icon color={color} size={18} />
    </View>
    <View style={styles.activityDetails}>
      <Text style={styles.activityText}>
        <Text style={styles.boldText}>{user}</Text> {action} for <Text style={styles.boldText}>{item}</Text>
      </Text>
      <Text style={styles.activityTime}>{time}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
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

export default SharedBudgets;
