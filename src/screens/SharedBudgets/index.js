import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { UserPlus, MessageCircle, Settings, Plane, Utensils } from 'lucide-react-native';
import { styles } from './styles';

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
          
          <Text style={styles.budgetAmount}>PKR 2,400 <Text style={styles.budgetTotal}>of PKR 5,000</Text></Text>
          
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: '48%' }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>48% completed</Text>
            <Text style={styles.progressText}>PKR 2,600 left</Text>
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

        /* Recent Activity */
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityList}>
          <ActivityItem 
            user="Sarah J." 
            action="added PKR 150" 
            item="Flights" 
            time="2h ago" 
            icon={Plane} 
            color="#2196F3"
          />
          <ActivityItem 
            user="Mark T." 
            action="added PKR 45" 
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

export default SharedBudgets;
