import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PALETTES, DEFAULT_PALETTE } from '../constants/theme';
import { getDb } from '../lib/db';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'app_theme';
const PALETTE_STORAGE_KEY = 'app_palette';

const ThemeContext = createContext({
  colors:      PALETTES[DEFAULT_PALETTE].dark,
  isDark:      true,
  toggleTheme: () => {},
  setTheme:    () => {},
  palette:     DEFAULT_PALETTE,
  setPalette:  () => {},
  palettes:    PALETTES,
});

export const ThemeProvider = ({ children }) => {
  const { userId, dbReady } = useAuth();
  const [isDark, setIsDark] = useState(true);
  const [palette, setPaletteKey] = useState(DEFAULT_PALETTE);

  useEffect(() => {
    const load = async () => {
      try {
        // AsyncStorage is the primary store (instant, no DB round-trip)
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored !== null) setIsDark(stored === 'dark');
        else if (userId && dbReady) {
          // Fallback: read from local SQLite
          const db  = getDb();
          const row = await db.getFirstAsync('SELECT theme FROM users WHERE id = ?', [userId]);
          if (row?.theme) {
            const dark = row.theme === 'dark';
            setIsDark(dark);
            await AsyncStorage.setItem(STORAGE_KEY, row.theme);
          }
        }

        const storedPalette = await AsyncStorage.getItem(PALETTE_STORAGE_KEY);
        if (storedPalette && PALETTES[storedPalette]) setPaletteKey(storedPalette);
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

  const setPalette = useCallback(async (key) => {
    if (!PALETTES[key]) return;
    setPaletteKey(key);
    try {
      await AsyncStorage.setItem(PALETTE_STORAGE_KEY, key);
    } catch {}
  }, []);

  const colors = isDark ? PALETTES[palette].dark : PALETTES[palette].light;

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggleTheme, setTheme, palette, setPalette, palettes: PALETTES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
