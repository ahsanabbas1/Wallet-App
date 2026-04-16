import React from 'react';
import { View, Text, Pressable, StyleSheet, Animated, TouchableWithoutFeedback, Dimensions } from 'react-native';
import { useDrawer } from '../context/DrawerContext';
import { COLORS, SIZES } from '../constants/theme';
import { Home, List, PieChart, MessageSquare, CreditCard, ShoppingBag, Users, LayoutDashboard, BarChart3, Target, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const { height, width } = Dimensions.get('window');

const DrawerItem = ({ icon: Icon, label, onPress }) => (
  <Pressable 
    style={({ pressed }) => [styles.drawerItem, pressed && { backgroundColor: 'rgba(255,255,255,0.05)' }]} 
    onPress={onPress}
  >
    <Icon color={COLORS.textSecondary} size={24} style={styles.icon} />
    <Text style={styles.drawerItemText}>{label}</Text>
  </Pressable>
);

const GlobalDrawer = () => {
  const { isOpen, closeDrawer, slideAnim, overlayAnim, drawerWidth } = useDrawer();
  const navigation = useNavigation();

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

        <View style={styles.menuItems}>
          <DrawerItem icon={Home} label="Dashboard" onPress={() => handleNavigate('Dashboard')} />
          <DrawerItem icon={List} label="Expenses" onPress={() => handleNavigate('Expenses')} />
          <DrawerItem icon={Target} label="Savings Goals" onPress={() => handleNavigate('Savings Goals')} />
          <DrawerItem icon={LayoutDashboard} label="Budgeting" onPress={() => handleNavigate('Budgeting')} />
          <DrawerItem icon={BarChart3} label="Reports" onPress={() => handleNavigate('Reports')} />
          <DrawerItem icon={MessageSquare} label="AI Assistant" onPress={() => handleNavigate('AI Assistant')} />
          <DrawerItem icon={CreditCard} label="Loyalty Cards" onPress={() => handleNavigate('Loyalty')} />
          <DrawerItem icon={ShoppingBag} label="Shopping List" onPress={() => handleNavigate('Shopping')} />
          <DrawerItem icon={Users} label="Shared Budgets" onPress={() => handleNavigate('Shared')} />
          <DrawerItem icon={PieChart} label="Financial Suite" onPress={() => handleNavigate('Financial Suite')} />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  drawer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.card,
    height: height,
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
});

export default GlobalDrawer;
