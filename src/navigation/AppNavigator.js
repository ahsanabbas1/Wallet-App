import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardOverview  from '../screens/DashboardOverview/index';
import ExpenseTracker     from '../screens/ExpenseTracker/index';
import Budgeting          from '../screens/Budgeting/index';
import Reports            from '../screens/Reports/index';
import AIAssistant        from '../screens/AIAssistant/index';
import Shopping           from '../screens/Shopping/index';
import SavingsGoals       from '../screens/SavingsGoals/index';
import PlannedPayments    from '../screens/PlannedPayments/index';
import Settings           from '../screens/Settings/index';
import Notifications      from '../screens/Notifications/index';
import About              from '../screens/About/index';
import AddTransaction     from '../screens/AddTransaction/index';
import LoanManagement    from '../screens/LoanManagement/index';
import Accounts           from '../screens/Accounts/index';
import Khums              from '../screens/Khums/index';
import FinancialCalendar  from '../screens/FinancialCalendar/index';
import Zakat              from '../screens/Zakat/index';
import { useTheme }       from '../context/ThemeContext';

const Stack = createNativeStackNavigator();

const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Dashboard"     component={DashboardOverview} />
    <Stack.Screen name="Expenses"      component={ExpenseTracker}    />
    <Stack.Screen name="Savings Goals" component={SavingsGoals}      />
    <Stack.Screen name="Planned"       component={PlannedPayments}   />
    <Stack.Screen name="Budgeting"     component={Budgeting}         />
    <Stack.Screen name="Reports"       component={Reports}           />
    <Stack.Screen name="AI Assistant"  component={AIAssistant}       />
    <Stack.Screen name="Shopping"      component={Shopping}          />
    <Stack.Screen name="Settings"      component={Settings}          />
    <Stack.Screen name="Notifications" component={Notifications}     />
    <Stack.Screen name="About"         component={About}             />
    <Stack.Screen name="Loans"         component={LoanManagement}    />
    <Stack.Screen name="Accounts"      component={Accounts}          />
    <Stack.Screen name="Khums"             component={Khums}             />
    <Stack.Screen name="FinancialCalendar" component={FinancialCalendar} />
    <Stack.Screen name="Zakat"             component={Zakat}             />
  </Stack.Navigator>
);

const AppNavigator = () => {
  const { colors: COLORS } = useTheme();

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
          headerShadowVisible: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;
