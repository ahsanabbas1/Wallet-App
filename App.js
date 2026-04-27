import 'react-native-url-polyfill/auto'
import React, { useEffect, useState } from 'react'

import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { DrawerProvider } from './src/context/DrawerContext'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import { ProfileProvider } from './src/context/ProfileContext'
import { ThemeProvider, useTheme } from './src/context/ThemeContext'
import GlobalDrawer from './src/components/GlobalDrawer'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './src/lib/supabase'
import Auth from './src/components/Auth/index'
import AppNavigator from './src/navigation/AppNavigator'
import { View, ActivityIndicator } from 'react-native'

const ensureUserProfile = async (user) => {
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!existing) {
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({ id: user.id, name: fullName, email: user.email }, { onConflict: 'id' });
      if (upsertError) console.warn('User profile upsert failed:', upsertError.message);
    }
  } catch (e) {
    console.warn('Could not ensure user profile:', e.message);
  }
};

// Innermost shell — has access to ThemeContext for StatusBar style
const ThemedShell = ({ children }) => {
  const { isDark } = useTheme();
  return (
    <>
      {children}
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
};

const AppContent = () => {
  const { session, loading } = useAuth();
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setProfileReady(false);
      ensureUserProfile(session.user).finally(() => setProfileReady(true));
    } else {
      setProfileReady(false);
    }
  }, [session?.user?.id]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1117' }}>
        <ActivityIndicator size="large" color="#4f5ff7" />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <ThemeProvider userId={null}>
        <ThemedShell>
          <Auth />
        </ThemedShell>
      </ThemeProvider>
    );
  }

  if (!profileReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1117' }}>
        <ActivityIndicator size="large" color="#4f5ff7" />
      </View>
    );
  }

  return (
    <ThemeProvider userId={session.user.id}>
      <ProfileProvider>
        <DrawerProvider>
          <NavigationContainer>
            <ThemedShell>
              <AppNavigator />
              <GlobalDrawer />
            </ThemedShell>
          </NavigationContainer>
        </DrawerProvider>
      </ProfileProvider>
    </ThemeProvider>
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
