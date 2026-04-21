import 'react-native-url-polyfill/auto'
import React, { useEffect } from 'react'

import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { DrawerProvider } from './src/context/DrawerContext'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import GlobalDrawer from './src/components/GlobalDrawer'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './src/lib/supabase'
import Auth from './src/components/Auth/index'
import AppNavigator from './src/navigation/AppNavigator'

const ensureUserProfile = async (user) => {
  try {
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
    await supabase
      .from('users')
      .upsert({ id: user.id, name: fullName, email: user.email }, { onConflict: 'id' });
  } catch (e) {
    console.warn('Could not ensure user profile:', e.message);
  }
};

// Inner component reads from AuthContext (already initialized by AuthProvider)
const AppContent = () => {
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user) ensureUserProfile(session.user);
  }, [session?.user?.id]);

  if (!session?.user) return <Auth />;

  return (
    <DrawerProvider>
      <NavigationContainer>
        <AppNavigator />
        <GlobalDrawer />
        <StatusBar style="light" />
      </NavigationContainer>
    </DrawerProvider>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}