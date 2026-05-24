import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_COLORS, LIGHT_COLORS } from '../constants/theme';
import { getDb } from '../lib/db';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'app_theme';

const ThemeContext = createContext({
  colors:      DARK_COLORS,
  isDark:      true,
  toggleTheme: () => {},
  setTheme:    () => {},
});

export const ThemeProvider = ({ children }) => {
  const { userId, dbReady } = useAuth();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // AsyncStorage is the primary store (instant, no DB round-trip)
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored !== null) { setIsDark(stored === 'dark'); return; }

        // Fallback: read from local SQLite
        if (userId && dbReady) {
          const db  = getDb();
          const row = await db.getFirstAsync('SELECT theme FROM users WHERE id = ?', [userId]);
          if (row?.theme) {
            const dark = row.theme === 'dark';
            setIsDark(dark);
            await AsyncStorage.setItem(STORAGE_KEY, row.theme);
          }
        }
      } catch {}
    };
    load();
  }, [userId, dbReady]);

  const setTheme = useCallback(async (dark) => {
    setIsDark(dark);
    const value = dark ? 'dark' : 'light';
    try {
      await AsyncStorage.setItem(STORAGE_KEY, value);
      if (userId && dbReady) {
        const db = getDb();
        await db.runAsync('UPDATE users SET theme = ? WHERE id = ?', [value, userId]);
      }
    } catch {}
  }, [userId, dbReady]);

  const toggleTheme = useCallback(() => setTheme(!isDark), [isDark, setTheme]);
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
