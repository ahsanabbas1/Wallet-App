import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

const ProfileContext = createContext({
  currency: 'PKR',
  name: '',
  loading: true,
  refresh: () => {},
  updateCurrency: () => {},
  updateName: () => {},
});

export const ProfileProvider = ({ children }) => {
  const { userId } = useAuth();
  const [currency, setCurrency] = useState('PKR');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('users')
        .select('name, currency')
        .eq('id', userId)
        .single();
      if (data) {
        setCurrency(data.currency || 'PKR');
        setName(data.name || '');
      }
    } catch {}
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const updateCurrency = useCallback((code) => {
    setCurrency(code);
  }, []);

  const updateName = useCallback((newName) => {
    setName(newName);
  }, []);

  return (
    <ProfileContext.Provider value={{ currency, name, loading, refresh, updateCurrency, updateName }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
