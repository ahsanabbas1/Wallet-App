import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, TouchableWithoutFeedback, Dimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useDrawer } from '../context/DrawerContext';
import { SIZES } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { Home, List, PieChart, MessageSquare, CreditCard, ShoppingBag, Users, LayoutDashboard, BarChart3, Target, X, CalendarClock, Settings, Bell, LogOut, Banknote, Building2, Landmark } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useProfile } from '../context/ProfileContext';

const { height: screenHeight } = Dimensions.get('screen');

const DrawerItem = ({ icon: Icon, label, onPress }) => {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <Pressable
      style={({ pressed }) => [styles.drawerItem, pressed && { backgroundColor: COLORS.surface }]}
      onPress={onPress}
    >
      <Icon color={COLORS.textSecondary} size={24} style={styles.icon} />
      <Text style={styles.drawerItemText}>{label}</Text>
    </Pressable>
  );
};

const GlobalDrawer = () => {
  const { isOpen, closeDrawer, slideAnim, overlayAnim, drawerWidth } = useDrawer();
  const navigation = useNavigation();
  const { colors: COLORS } = useTheme();
  const { madhab } = useProfile();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();

  if (!isOpen) {
     return null;
  }

  const handleNavigate = (screenName) => {
    closeDrawer();
    // setTimeout to allow drawer to close smoothly before navigating
    setTimeout(() => {
      navigation.navigate(screenName);
    }, 200);
  };

  const handleLogout = async () => {
    closeDrawer();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
    }
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Background Overlay */}
      <TouchableWithoutFeedback onPress={closeDrawer}>
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
      </TouchableWithoutFeedback>

      {/* Drawer Panel */}
      <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Menu</Text>
          <Pressable onPress={closeDrawer} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <X color={COLORS.textSecondary} size={24} />
          </Pressable>
        </View>

        <ScrollView style={styles.menuItems} showsVerticalScrollIndicator={false}>
          {/* ── Overview ── */}
          <DrawerItem icon={Home}          label="Dashboard"       onPress={() => handleNavigate('Dashboard')} />
          <DrawerItem icon={Building2}     label="Accounts"        onPress={() => handleNavigate('Accounts')} />
          <DrawerItem icon={List}          label="Expenses"        onPress={() => handleNavigate('Expenses')} />

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionLabel}>PLANNING</Text>
          <DrawerItem icon={LayoutDashboard} label="Budgeting"       onPress={() => handleNavigate('Budgeting')} />
          <DrawerItem icon={Target}          label="Savings Goals"   onPress={() => handleNavigate('Savings Goals')} />
          <DrawerItem icon={CalendarClock}   label="Planned Payments" onPress={() => handleNavigate('Planned')} />

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionLabel}>INSIGHTS</Text>
          <DrawerItem icon={BarChart3}     label="Reports"         onPress={() => handleNavigate('Reports')} />
          <DrawerItem icon={MessageSquare} label="AI Assistant"    onPress={() => handleNavigate('AI Assistant')} />

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionLabel}>TOOLS</Text>
          <DrawerItem icon={Banknote}      label="Loan Management" onPress={() => handleNavigate('Loans')} />
          <DrawerItem icon={ShoppingBag}   label="Shopping List"   onPress={() => handleNavigate('Shopping')} />
          {madhab === 'shia' && (
            <DrawerItem icon={Landmark}    label="Khums"           onPress={() => handleNavigate('Khums')} />
          )}

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionLabel}>SYSTEM</Text>
          <DrawerItem icon={Bell}     label="Notifications" onPress={() => handleNavigate('Notifications')} />
          <DrawerItem icon={Settings} label="Settings"      onPress={() => handleNavigate('Settings')} />
          
          <View style={styles.divider} />
          
          <Pressable 
            style={({ pressed }) => [styles.drawerItem, styles.logoutItem, pressed && { backgroundColor: 'rgba(244, 67, 54, 0.1)' }]} 
            onPress={handleLogout}
          >
            <LogOut color={COLORS.error} size={24} style={styles.icon} />
            <Text style={[styles.drawerItemText, { color: COLORS.error }]}>Logout</Text>
          </Pressable>
          
          <View style={{ height: Math.max(40, insets.bottom + 24) }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    height: screenHeight,
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    paddingTop: 60, // approximate safe area
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuItems: {
    paddingVertical: 20,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: SIZES.padding,
  },
  icon: {
    marginRight: 15,
  },
  drawerItemText: {
    color: COLORS.text,
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 10,
    marginHorizontal: SIZES.padding,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 8,
    marginHorizontal: SIZES.padding,
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    opacity: 0.6,
    paddingHorizontal: SIZES.padding,
    paddingTop: 10,
    paddingBottom: 2,
  },
  logoutItem: {
    marginTop: 5,
  }
});

export default GlobalDrawer;
