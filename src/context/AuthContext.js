import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { openUserDatabase } from '../lib/db';
import { isMigrationDone, runInitialMigration } from '../services/dataMigrationService';

// Cached user is stored here so the app survives offline token expiry
const AUTH_CACHE_KEY = 'auth_user_cache';
// Set to 'true' when user explicitly signs out — prevents re-entry via cache
const AUTH_SIGNED_OUT_KEY = 'auth_signed_out';

const AuthContext = createContext(null);

const extractTokensFromUrl = (url) => {
  if (!url) return null;
  try {
    const hashPart = url.split('#')[1];
    if (!hashPart) return null;
    const params       = new URLSearchParams(hashPart);
    const access_token  = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) return { access_token, refresh_token };
  } catch (_) {}
  return null;
};

export const AuthProvider = ({ children }) => {
  const [session,             setSession]             = useState(null);
  const [offlineUser,         setOfflineUser]         = useState(null); // cached user when offline
  const [dbStatus,            setDbStatus]            = useState('idle');
  const [loading,             setLoading]             = useState(true);
  const [migrationProgress,   setMigrationProgress]   = useState('');
  const initRef = useRef(null);

  // ─── persist user identity so offline users stay logged in ───────────────
  const cacheUser = async (user) => {
    if (!user?.id) return;
    await AsyncStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
      id:            user.id,
      email:         user.email,
      user_metadata: user.user_metadata || {},
    }));
    await AsyncStorage.removeItem(AUTH_SIGNED_OUT_KEY);
  };

  const clearUserCache = async () => {
    await AsyncStorage.multiRemove([AUTH_CACHE_KEY, AUTH_SIGNED_OUT_KEY]);
    await AsyncStorage.setItem(AUTH_SIGNED_OUT_KEY, 'true');
  };

  // ─── open SQLite and run migration ───────────────────────────────────────
  const initDatabase = async (userId, sessionForMigration = null) => {
    if (!userId) return;
    if (initRef.current) return initRef.current;

    initRef.current = (async () => {
      setDbStatus('opening');
      try {
        await openUserDatabase(userId);
        const done = await isMigrationDone(userId);
        if (!done && sessionForMigration) {
          setDbStatus('migrating');
          await runInitialMigration(userId, sessionForMigration, setMigrationProgress);
        }
        setDbStatus('ready');
      } catch (e) {
        console.error('DB init error:', e.message);
        setDbStatus('ready');
      } finally {
        initRef.current = null;
      }
    })();
    return initRef.current;
  };

  // ─── deep-link handler ───────────────────────────────────────────────────
  const handleDeepLink = async (url) => {
    const tokens = extractTokensFromUrl(url);
    if (tokens) {
      const { data, error } = await supabase.auth.setSession(tokens);
      if (!error && data?.session) {
        setSession(data.session);
        await cacheUser(data.session.user);
      }
    }
  };

  // ─── bootstrap ───────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // Online: full session available
          if (mounted) setSession(session);
          await cacheUser(session.user);
          await initDatabase(session.user.id, session);
        } else {
          // No active session — check if user explicitly signed out
          const signedOut = await AsyncStorage.getItem(AUTH_SIGNED_OUT_KEY);
          if (signedOut === 'true') {
            // User logged out on purpose — show login screen
          } else {
            // Check for cached identity (offline / token expired scenario)
            const raw = await AsyncStorage.getItem(AUTH_CACHE_KEY);
            if (raw) {
              const cached = JSON.parse(raw);
              if (mounted) setOfflineUser(cached);
              // Open SQLite with cached userId — no migration needed (already done)
              await initDatabase(cached.id, null);
            }
          }
        }
      } catch (e) {
        // Network error during getSession — try offline cache
        const raw = await AsyncStorage.getItem(AUTH_CACHE_KEY);
        if (raw) {
          try {
            const cached = JSON.parse(raw);
            if (mounted) setOfflineUser(cached);
            await initDatabase(cached.id, null);
          } catch (_) {}
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    // Auth state changes (sign-in / sign-out / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setSession(session);
        setOfflineUser(null);
        await cacheUser(session.user);
        await initDatabase(session.user.id, session);
      } else {
        // Only clear session — don't clear offlineUser here (bootstrap handles that)
        setSession(null);
        setDbStatus(prev => prev === 'ready' ? 'ready' : 'idle');
      }
      setLoading(false);
    });

    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    Linking.getInitialURL().then(url => { if (url) handleDeepLink(url); });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  // ─── sign out: clear cache so offline re-entry is blocked ────────────────
  const signOut = async () => {
    await clearUserCache();
    setOfflineUser(null);
    setSession(null);
    setDbStatus('idle');
    await supabase.auth.signOut();
  };

  // Effective user (online session or offline cache)
  const effectiveUser   = session?.user ?? offlineUser ?? null;
  const effectiveUserId = effectiveUser?.id ?? null;

  return (
    <AuthContext.Provider value={{
      session,
      user:              effectiveUser,
      userId:            effectiveUserId,
      offlineMode:       !session && !!offlineUser,
      loading:           loading || dbStatus === 'opening' || dbStatus === 'migrating',
      dbReady:           dbStatus === 'ready',
      migrationProgress,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
