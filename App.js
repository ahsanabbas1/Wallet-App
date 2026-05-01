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
import { View, Text, ActivityIndicator, AppState } from 'react-native'
import localDatabase from './src/services/localDatabase'
import transactionSyncService from './src/services/transactionSyncService'
import financeSyncService from './src/services/financeSyncService'

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

const ThemedShell = ({ children }) => {
  const { isDark } = useTheme();
  return (
    <>
      {children}
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
};

const SyncingScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1117', gap: 16 }}>
    <ActivityIndicator size="large" color="#4f5ff7" />
    <Text style={{ color: '#8b8fa8', fontSize: 14, fontWeight: '500' }}>Loading your data…</Text>
  </View>
);

const AppContent = () => {
  const { session, loading } = useAuth();
  const [profileReady, setProfileReady] = useState(false);
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  // Ensure user profile exists in Supabase on login
  useEffect(() => {
    if (session?.user) {
      setProfileReady(false);
      setInitialSyncDone(false);
      ensureUserProfile(session.user).finally(() => setProfileReady(true));
    } else {
      setProfileReady(false);
      setInitialSyncDone(false);
    }
  }, [session?.user?.id]);

  // Initial sync — blocking if local DB is empty (new install / APK reinstall)
  useEffect(() => {
    if (!session?.user || !profileReady) return;

    const userId = session.user.id;

    const doInitialSync = async () => {
      try {
        await localDatabase.initialize();

        const [localTx, localCats] = await Promise.all([
          localDatabase.getTransactions(userId),
          localDatabase.getCategories(userId),
        ]);

        const isEmpty = localTx.length === 0 && localCats.length === 0;

        if (isEmpty) {
          // New install or cleared storage — pull from Supabase with a 12s safety timeout
          const syncAll = Promise.allSettled([
            transactionSyncService.refreshTransactions(userId),
            financeSyncService.refreshAll(userId),
          ]);
          const timeout = new Promise(resolve => setTimeout(resolve, 12000));
          await Promise.race([syncAll, timeout]);
        } else {
          // Data exists — sync in background, show app immediately
          transactionSyncService.refreshTransactions(userId).catch(() => {});
          financeSyncService.refreshAll(userId).catch(() => {});
        }
      } catch {
        // Any unexpected error — proceed to app rather than staying stuck
      } finally {
        setInitialSyncDone(true);
      }
    };

    doInitialSync().catch(() => { setInitialSyncDone(true); });
  }, [session?.user?.id, profileReady]);

  // Sync on app resume (foreground)
  useEffect(() => {
    if (!session?.user) return;

    const userId = session.user.id;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        transactionSyncService.refreshTransactions(userId).catch(() => {});
        financeSyncService.refreshAll(userId).catch(() => {});
      }
    });

    return () => { subscription.remove(); };
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

  if (!profileReady || !initialSyncDone) {
    return <SyncingScreen />;
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
