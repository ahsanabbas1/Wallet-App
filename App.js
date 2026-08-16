import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';

import { NavigationContainer }      from '@react-navigation/native';
import { SafeAreaProvider }         from 'react-native-safe-area-context';
import { DrawerProvider }           from './src/context/DrawerContext';
import { AuthProvider, useAuth }    from './src/context/AuthContext';
import { ProfileProvider }          from './src/context/ProfileContext';
import { ThemeProvider, useTheme }  from './src/context/ThemeContext';
import { LockProvider, useLock }    from './src/context/LockContext';
import { LedgerFilterProvider }     from './src/context/LedgerFilterContext';
import { AccountsFilterProvider }   from './src/context/AccountsFilterContext';
import { ReportsFilterProvider }    from './src/context/ReportsFilterContext';
import GlobalDrawer                 from './src/components/GlobalDrawer';
import LockScreen                   from './src/screens/LockScreen/index';
import { StatusBar }                from 'expo-status-bar';
import { supabase }                 from './src/lib/supabase';
import Auth                         from './src/components/Auth/index';
import AppNavigator                 from './src/navigation/AppNavigator';
import { View, ActivityIndicator }  from 'react-native';

// Best-effort — creates the remote Supabase user profile row if missing.
// Never blocks app loading; silently skips when offline.
const ensureUserProfile = async (user) => {
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!existing) {
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name      ||
        user.email?.split('@')[0]     || '';
      await supabase
        .from('users')
        .upsert({ id: user.id, name: fullName, email: user.email }, { onConflict: 'id' });
    }
  } catch (_) {
    // Offline or network error — ignore, SQLite is the source of truth
  }
};

// ── Themed status bar ───────────────────────────────────────────────────────
const ThemedShell = ({ children }) => {
  const { isDark } = useTheme();
  return (
    <>
      {children}
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
};

// ── Lock gate: shows spinner while LockContext loads, LockScreen when locked ─
const LockGate = ({ children }) => {
  const { isLocked, ready } = useLock();
  if (!ready) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1117' }}>
      <ActivityIndicator size="large" color="#4f5ff7" />
    </View>
  );
  if (isLocked) return <LockScreen />;
  return children;
};

// ── Main content ─────────────────────────────────────────────────────────────
const AppContent = () => {
  const { session, userId, offlineMode, loading } = useAuth();
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (session?.user) {
      // Fire-and-forget: sync remote Supabase profile row (skips offline)
      setProfileReady(true);
      ensureUserProfile(session.user).catch(() => {});
    } else if (offlineMode && userId) {
      // Offline: SQLite is ready, skip remote sync entirely
      setProfileReady(true);
    } else {
      setProfileReady(false);
    }
  }, [session?.user?.id, offlineMode, userId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1117' }}>
        <ActivityIndicator size="large" color="#4f5ff7" />
      </View>
    );
  }

  // Not logged in and no cached session — show auth screen
  if (!userId) {
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
    <ThemeProvider userId={userId}>
      <ProfileProvider>
        <LockProvider>
          <LockGate>
            <DrawerProvider>
              <LedgerFilterProvider>
                <AccountsFilterProvider>
                  <ReportsFilterProvider>
                    <NavigationContainer>
                      <ThemedShell>
                        <AppNavigator />
                        <GlobalDrawer />
                      </ThemedShell>
                    </NavigationContainer>
                  </ReportsFilterProvider>
                </AccountsFilterProvider>
              </LedgerFilterProvider>
            </DrawerProvider>
          </LockGate>
        </LockProvider>
      </ProfileProvider>
    </ThemeProvider>
  );
};

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
