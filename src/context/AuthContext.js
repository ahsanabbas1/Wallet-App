import React, { createContext, useContext, useState, useEffect } from 'react';
import { Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { openUserDatabase } from '../lib/db';
import { isMigrationDone, runInitialMigration } from '../services/dataMigrationService';

const AuthContext = createContext(null);

const extractTokensFromUrl = (url) => {
  if (!url) return null;
  try {
    const hashPart = url.split('#')[1];
    if (!hashPart) return null;
    const params = new URLSearchParams(hashPart);
    const access_token  = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) return { access_token, refresh_token };
  } catch (_) {}
  return null;
};

export const AuthProvider = ({ children }) => {
  const [session,         setSession]         = useState(null);
  const [loading,         setLoading]         = useState(true);
  // 'idle' | 'opening' | 'migrating' | 'ready'
  const [dbStatus,        setDbStatus]        = useState('idle');
  const [migrationProgress, setMigrationProgress] = useState('');

  const initRef = React.useRef(null);

  const handleDeepLink = async (url) => {
    const tokens = extractTokensFromUrl(url);
    if (tokens) {
      const { data, error } = await supabase.auth.setSession(tokens);
      if (!error && data?.session) setSession(data.session);
    }
  };

  // Called whenever we get a non-null session — opens the per-user SQLite DB
  // and runs the one-time cloud→local migration if needed
  const initDatabase = async (sess) => {
    const userId = sess?.user?.id;
    if (!userId) return;
    if (initRef.current) return initRef.current;

    initRef.current = (async () => {
      setDbStatus('opening');
      try {
        await openUserDatabase(userId);

        const done = await isMigrationDone(userId);
        if (!done) {
          setDbStatus('migrating');
          await runInitialMigration(userId, sess, setMigrationProgress);
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

  useEffect(() => {
    // 1. Restore persisted session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) await initDatabase(session);
      setLoading(false);
    });

    // 2. Auth state changes (sign in / sign out / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await initDatabase(session);
      } else {
        setDbStatus('idle');
      }
      setLoading(false);
    });

    // 3. Deep-link while app is open
    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    // 4. Deep-link cold start
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });

    return () => {
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      user:              session?.user ?? null,
      userId:            session?.user?.id ?? null,
      loading:           loading || dbStatus === 'opening' || dbStatus === 'migrating',
      dbReady:           dbStatus === 'ready',
      migrationProgress,
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
