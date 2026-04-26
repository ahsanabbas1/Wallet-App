import React, { createContext, useContext, useState, useEffect } from 'react';
import { Linking } from 'react-native';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

/**
 * Parse the access_token and refresh_token from a deep-link URL.
 * Supabase puts them in the hash fragment: wallet-app://home#access_token=...
 */
const extractTokensFromUrl = (url) => {
  if (!url) return null;
  try {
    // Tokens are in the hash fragment (#)
    const hashPart = url.split('#')[1];
    if (!hashPart) return null;
    const params = new URLSearchParams(hashPart);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) return { access_token, refresh_token };
  } catch (_) {}
  return null;
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Handle an incoming deep-link URL and set the session if tokens are present
  const handleDeepLink = async (url) => {
    const tokens = extractTokensFromUrl(url);
    if (tokens) {
      const { data, error } = await supabase.auth.setSession(tokens);
      if (!error && data?.session) {
        setSession(data.session);
      }
    }
  };

  useEffect(() => {
    // 1. Restore persisted session from AsyncStorage on launch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    // 3. Handle deep link if app was ALREADY open when the email link was clicked
    const linkSubscription = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    // 4. Handle deep link if app was COLD-STARTED by clicking the email link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => {
      subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, userId: session?.user?.id ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
