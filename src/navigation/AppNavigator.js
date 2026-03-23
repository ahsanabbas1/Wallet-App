import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, List, PieChart, MessageSquare, CreditCard, ShoppingBag, Users, LayoutDashboard, BarChart } from 'lucide-react-native';
import DashboardOverview from '../screens/DashboardOverview';
import ExpenseTracker from '../screens/ExpenseTracker';
import Budgeting from '../screens/Budgeting';
import Reports from '../screens/Reports';
import AIAssistant from '../screens/AIAssistant';
import LoyaltyCards from '../screens/LoyaltyCards';
import Shopping from '../screens/Shopping';
import SharedBudgets from '../screens/SharedBudgets';
import FinancialSuite from '../screens/FinancialSuite';
import { COLORS } from '../constants/theme';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AddTransaction from '../screens/AddTransaction';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let IconComponent;
          if (route.name === 'Dashboard') IconComponent = Home;
          else if (route.name === 'Expenses') IconComponent = List;
          else if (route.name === 'Budgeting') IconComponent = LayoutDashboard;
          else if (route.name === 'Reports') IconComponent = BarChart;
          else if (route.name === 'AI Assistant') IconComponent = MessageSquare;
          else if (route.name === 'Loyalty') IconComponent = CreditCard;
          else if (route.name === 'Shopping') IconComponent = ShoppingBag;
          else if (route.name === 'Shared') IconComponent = Users;
          else if (route.name === 'Financial Suite') IconComponent = PieChart;

          return <IconComponent color={color} size={size} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: 'transparent',
        },
        headerStyle: {
          backgroundColor: COLORS.card,
        },
        headerTintColor: COLORS.text,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardOverview} />
      <Tab.Screen name="Expenses" component={ExpenseTracker} />
      <Tab.Screen name="Budgeting" component={Budgeting} />
      <Tab.Screen name="Reports" component={Reports} />
      <Tab.Screen name="AI Assistant" component={AIAssistant} />
      <Tab.Screen name="Loyalty" component={LoyaltyCards} />
      <Tab.Screen name="Shopping" component={Shopping} />
      <Tab.Screen name="Shared" component={SharedBudgets} />
      <Tab.Screen name="Financial Suite" component={FinancialSuite} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen 
        name="AddTransaction" 
        component={AddTransaction} 
        options={{ 
          headerShown: true, 
          title: 'Add Record',
          headerStyle: { backgroundColor: COLORS.card },
          headerTintColor: COLORS.text,
        }} 
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;
