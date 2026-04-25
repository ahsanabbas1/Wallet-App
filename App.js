import 'react-native-url-polyfill/auto'
import React, { useEffect, useState } from 'react'

import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { DrawerProvider } from './src/context/DrawerContext'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import GlobalDrawer from './src/components/GlobalDrawer'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './src/lib/supabase'
import Auth from './src/components/Auth/index'
import AppNavigator from './src/navigation/AppNavigator'
import { View, ActivityIndicator } from 'react-native'

const ensureUserProfile = async (user) => {
  try {
    // Use maybeSingle() — returns null data (no error) when 0 rows found,
    // unlike single() which throws PGRST116 error for 0 rows.
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    // If no profile exists, create one with default metadata
    if (!existing) {
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
      // Use upsert to handle any race conditions (e.g. duplicate calls)
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({ 
          id: user.id, 
          name: fullName, 
          email: user.email 
        }, { onConflict: 'id' });

      if (upsertError) {
        console.warn('User profile upsert failed:', upsertError.message);
      }
    }
  } catch (e) {
    console.warn('Could not ensure user profile:', e.message);
  }
};

// Inner component reads from AuthContext (already initialized by AuthProvider)
const AppContent = () => {
  const { session } = useAuth();
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setProfileReady(false);
      ensureUserProfile(session.user).finally(() => setProfileReady(true));
    } else {
      setProfileReady(false);
    }
  }, [session?.user?.id]);

  if (!session?.user) return <Auth />;

  // Block the app until user profile row is guaranteed to exist
  if (!profileReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0e1a' }}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

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