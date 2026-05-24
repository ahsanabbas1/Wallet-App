import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getDb } from '../lib/db';

const ProfileContext = createContext({
  currency: 'PKR',
  name:     '',
  loading:  true,
  refresh:        () => {},
  updateCurrency: () => {},
  updateName:     () => {},
});

export const ProfileProvider = ({ children }) => {
  const { userId, dbReady } = useAuth();
  const [currency, setCurrency] = useState('PKR');
  const [name,     setName]     = useState('');
  const [loading,  setLoading]  = useState(true);

  const refresh = useCallback(async () => {
    if (!userId || !dbReady) { setLoading(false); return; }
    try {
      const db   = getDb();
      const row  = await db.getFirstAsync(
        'SELECT name, currency FROM users WHERE id = ?',
        [userId]
      );
      if (row) {
        setCurrency(row.currency || 'PKR');
        setName(row.name || '');
      }
    } catch {}
    finally { setLoading(false); }
  }, [userId, dbReady]);

  useEffect(() => { refresh(); }, [refresh]);

  const updateCurrency = useCallback(async (code) => {
    setCurrency(code);
    if (!userId || !dbReady) return;
    try {
      const db = getDb();
      await db.runAsync('UPDATE users SET currency = ? WHERE id = ?', [code, userId]);
    } catch {}
  }, [userId, dbReady]);

  const updateName = useCallback(async (newName) => {
    setName(newName);
    if (!userId || !dbReady) return;
    try {
      const db = getDb();
      await db.runAsync('UPDATE users SET name = ? WHERE id = ?', [newName, userId]);
    } catch {}
  }, [userId, dbReady]);

  return (
    <ProfileContext.Provider value={{ currency, name, loading, refresh, updateCurrency, updateName }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
