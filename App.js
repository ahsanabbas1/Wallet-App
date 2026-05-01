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
import { View, Text, ActivityIndicator, AppState, TouchableOpacity, Alert } from 'react-native'
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

const SyncingScreen = ({ error, onSkip }) => (
  <View style={{ 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#0f1117', 
    padding: 32, 
    gap: 20 
  }}>
    {!error ? (
      <>
        <ActivityIndicator size="large" color="#4f5ff7" />
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600' }}>Syncing Data</Text>
          <Text style={{ color: '#8b8fa8', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            We're fetching your records from the cloud. This might take a moment...
          </Text>
        </View>
      </>
    ) : (
      <>
        <View style={{ 
          width: 64, 
          height: 64, 
          borderRadius: 32, 
          backgroundColor: '#3b1d1d', 
          justifyContent: 'center', 
          alignItems: 'center',
          marginBottom: 8
        }}>
          <Text style={{ fontSize: 32 }}>⚠️</Text>
        </View>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold' }}>Connection Notice</Text>
          <Text style={{ color: '#8b8fa8', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            {error}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={onSkip}
          activeOpacity={0.8}
          style={{ 
            backgroundColor: '#4f5ff7', 
            paddingVertical: 14, 
            paddingHorizontal: 32, 
            borderRadius: 12, 
            marginTop: 12,
            shadowColor: '#4f5ff7',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Enter Dashboard</Text>
        </TouchableOpacity>
      </>
    )}
  </View>
);

const AppContent = () => {
  const { session, loading } = useAuth();
  const [profileReady, setProfileReady] = useState(false);
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const [syncError, setSyncError] = useState(null);

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
        
        // Log diagnostics for APK debugging
        const diag = await localDatabase.getDiagnostics();
        console.log('[Sync] Database Diagnostics:', JSON.stringify(diag));

        const [localTx, localCats] = await Promise.all([
          localDatabase.getTransactions(userId),
          localDatabase.getCategories(userId),
        ]);

        const isEmpty = localTx.length === 0 && localCats.length === 0;

        if (isEmpty) {
          console.log('[Sync] Local DB is empty, starting full pull...');
          
          // Pull from Supabase with a longer safety timeout for mobile
          const syncTasks = Promise.all([
            transactionSyncService.refreshTransactions(userId),
            financeSyncService.refreshAll(userId),
          ]);
          
          const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Sync is taking a while. You can skip waiting and we will finish syncing in the background.')), 20000)
          );

          try {
            await Promise.race([syncTasks, timeout]);
            console.log('[Sync] Initial pull completed successfully.');
          } catch (e) {
            console.warn('[Sync] Initial pull timed out or failed:', e.message);
            setSyncError(e.message);
            return; // Don't proceed to setInitialSyncDone yet, let user skip
          }
        } else {
          console.log('[Sync] Local data found, syncing in background.');
          transactionSyncService.refreshTransactions(userId).catch(e => console.warn('Background sync fail:', e));
          financeSyncService.refreshAll(userId).catch(e => console.warn('Background sync fail:', e));
        }
        setInitialSyncDone(true);
      } catch (err) {
        console.error('[Sync] Fatal initialization error:', err);
        setSyncError('Failed to initialize local database: ' + err.message);
      }
    };

    doInitialSync();
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
    return (
      <SyncingScreen 
        error={syncError} 
        onSkip={() => {
          console.log('[Sync] User skipped wait.');
          setInitialSyncDone(true);
        }} 
      />
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
