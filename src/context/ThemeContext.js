import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_COLORS, LIGHT_COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'app_theme';

const ThemeContext = createContext({
  colors:      DARK_COLORS,
  isDark:      true,
  toggleTheme: () => {},
  setTheme:    () => {},
});

export const ThemeProvider = ({ userId, children }) => {
  const [isDark, setIsDark] = useState(true);

  // Load saved theme on mount (AsyncStorage first, then DB)
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
          setIsDark(stored === 'dark');
          return;
        }
        // Fallback: read from DB if no local preference
        if (userId) {
          const { data } = await supabase
            .from('users')
            .select('theme')
            .eq('id', userId)
            .single();
          if (data?.theme) {
            const dark = data.theme === 'dark';
            setIsDark(dark);
            await AsyncStorage.setItem(STORAGE_KEY, data.theme);
          }
        }
      } catch {}
    };
    load();
  }, [userId]);

  const setTheme = useCallback(async (dark) => {
    setIsDark(dark);
    const value = dark ? 'dark' : 'light';
    try {
      await AsyncStorage.setItem(STORAGE_KEY, value);
      if (userId) {
        await supabase.from('users').update({ theme: value }).eq('id', userId);
      }
    } catch {}
  }, [userId]);

  const toggleTheme = useCallback(() => setTheme(!isDark), [isDark, setTheme]);

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
