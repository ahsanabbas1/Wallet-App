import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, List, PieChart, MessageSquare, CreditCard, ShoppingBag, Users, LayoutDashboard, BarChart3, Target } from 'lucide-react-native';
import DashboardOverview from '../screens/DashboardOverview/index';
import ExpenseTracker from '../screens/ExpenseTracker/index';
import Budgeting from '../screens/Budgeting/index';
import Reports from '../screens/Reports/index';
import AIAssistant from '../screens/AIAssistant/index';
import LoyaltyCards from '../screens/LoyaltyCards/index';
import Shopping from '../screens/Shopping/index';
import SharedBudgets from '../screens/SharedBudgets/index';
import FinancialSuite from '../screens/FinancialSuite/index';
import SavingsGoals from '../screens/SavingsGoals/index';
import PlannedPayments from '../screens/PlannedPayments/index';
import Settings       from '../screens/Settings/index';
import Notifications  from '../screens/Notifications/index';
import { COLORS } from '../constants/theme';
import AddTransaction from '../screens/AddTransaction/index';

const Stack = createNativeStackNavigator();

const MainStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardOverview} />
      <Stack.Screen name="Expenses" component={ExpenseTracker} />
      <Stack.Screen name="Savings Goals" component={SavingsGoals} />
      <Stack.Screen name="Planned" component={PlannedPayments} />
      <Stack.Screen name="Budgeting" component={Budgeting} />
      <Stack.Screen name="Reports" component={Reports} />
      <Stack.Screen name="AI Assistant" component={AIAssistant} />
      {/* <Stack.Screen name="Loyalty" component={LoyaltyCards} /> */}
      <Stack.Screen name="Shopping" component={Shopping} />
      {/* <Stack.Screen name="Shared" component={SharedBudgets} /> */}
      {/* <Stack.Screen name="Financial Suite" component={FinancialSuite} /> */}
      <Stack.Screen name="Settings"       component={Settings}       />
      <Stack.Screen name="Notifications"  component={Notifications}  />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainStack} />
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
