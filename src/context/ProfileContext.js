import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { getDb } from '../lib/db';

// AsyncStorage key — per user so switching accounts doesn't bleed settings
const profileKey = (userId) => `profile_v1_${userId}`;

const ProfileContext = createContext({
  currency:       'PKR',
  name:           '',
  madhab:         'sunni',
  loading:        true,
  refresh:        () => {},
  updateCurrency: () => {},
  updateName:     () => {},
  updateMadhab:   () => {},
});

export const ProfileProvider = ({ children }) => {
  const { userId, dbReady } = useAuth();
  const [currency, setCurrency] = useState('PKR');
  const [name,     setName]     = useState('');
  const [madhab,   setMadhab]   = useState('sunni');
  const [loading,  setLoading]  = useState(true);
  const syncedRef = useRef(false); // prevent double SQLite sync per session

  // ── Load: AsyncStorage first (instant), then SQLite to confirm ───────────
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    syncedRef.current = false;

    const load = async () => {
      // 1. Instant load from AsyncStorage cache
      try {
        const raw = await AsyncStorage.getItem(profileKey(userId));
        if (raw) {
          const cached = JSON.parse(raw);
          setCurrency(cached.currency || 'PKR');
          setName(cached.name     || '');
          setMadhab(cached.madhab || 'sunni');
          setLoading(false); // show cached values immediately
        }
      } catch (_) {}

      // 2. Sync from SQLite when DB is ready (runs once per session)
      if (dbReady && !syncedRef.current) {
        syncedRef.current = true;
        try {
          const db  = getDb();
          const row = await db.getFirstAsync(
            'SELECT name, currency, madhab FROM users WHERE id = ?',
            [userId]
          );
          if (row) {
            const fresh = {
              currency: row.currency || 'PKR',
              name:     row.name     || '',
              madhab:   row.madhab   || 'sunni',
            };
            setCurrency(fresh.currency);
            setName(fresh.name);
            setMadhab(fresh.madhab);
            // Write back to AsyncStorage to keep cache in sync
            await AsyncStorage.setItem(profileKey(userId), JSON.stringify(fresh));
          }
        } catch (_) {}
        setLoading(false);
      }
    };

    load();
  }, [userId, dbReady]);

  // ── Generic setter: state + AsyncStorage + SQLite ────────────────────────
  const persist = useCallback(async (key, value, setter) => {
    setter(value);
    if (!userId) return;

    // Update AsyncStorage immediately
    try {
      const raw     = await AsyncStorage.getItem(profileKey(userId));
      const current = raw ? JSON.parse(raw) : { currency: 'PKR', name: '', madhab: 'sunni' };
      await AsyncStorage.setItem(profileKey(userId), JSON.stringify({ ...current, [key]: value }));
    } catch (_) {}

    // Persist to SQLite when available
    if (!dbReady) return;
    try {
      const db = getDb();
      await db.runAsync(`UPDATE users SET ${key} = ? WHERE id = ?`, [value, userId]);
    } catch (_) {}
  }, [userId, dbReady]);

  const updateCurrency = useCallback((code)  => persist('currency', code,  setCurrency), [persist]);
  const updateName     = useCallback((n)     => persist('name',     n,     setName),     [persist]);
  const updateMadhab   = useCallback((m)     => persist('madhab',   m,     setMadhab),   [persist]);

  const refresh = useCallback(async () => {
    if (!userId || !dbReady) return;
    try {
      const db  = getDb();
      const row = await db.getFirstAsync(
        'SELECT name, currency, madhab FROM users WHERE id = ?',
        [userId]
      );
      if (row) {
        const fresh = {
          currency: row.currency || 'PKR',
          name:     row.name     || '',
          madhab:   row.madhab   || 'sunni',
        };
        setCurrency(fresh.currency);
        setName(fresh.name);
        setMadhab(fresh.madhab);
        await AsyncStorage.setItem(profileKey(userId), JSON.stringify(fresh));
      }
    } catch (_) {}
  }, [userId, dbReady]);

  return (
    <ProfileContext.Provider value={{
      currency, name, madhab, loading,
      refresh, updateCurrency, updateName, updateMadhab,
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
