import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import offlineSync from '../services/offlineSync';

const ProfileContext = createContext({
  currency: 'PKR',
  name: '',
  loading: true,
  refresh: () => {},
  updateCurrency: () => {},
});

export const ProfileProvider = ({ children }) => {
  const { userId } = useAuth();
  const [currency, setCurrency] = useState('PKR');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data } = await offlineSync.getUserProfile(userId);
      if (data) {
        setCurrency(data.currency || 'PKR');
        setName(data.name || '');
      }
    } catch {}
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Called from Settings after a successful currency save
  const updateCurrency = useCallback((code) => {
    setCurrency(code);
    if (userId) {
      offlineSync.saveUserProfile(userId, { currency: code }).catch(() => {});
    }
  }, [userId]);

  // Called from Settings after a successful name save
  const updateName = useCallback((newName) => {
    setName(newName);
    if (userId) {
      offlineSync.saveUserProfile(userId, { name: newName }).catch(() => {});
    }
  }, [userId]);

  return (
    <ProfileContext.Provider value={{ currency, name, loading, refresh, updateCurrency, updateName }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
