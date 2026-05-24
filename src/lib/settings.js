import { getDb } from './db';
import { supabase } from './supabase';

// Resolves the current userId from the Supabase auth session (still used for auth only)
async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export const getUserSettings = async () => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return {};

    const db  = getDb();
    const row = await db.getFirstAsync(
      'SELECT settings FROM user_settings WHERE user_id = ?',
      [userId]
    );
    if (!row) return {};
    return row.settings ? JSON.parse(row.settings) : {};
  } catch (error) {
    console.warn('Error fetching user settings:', error.message);
    return {};
  }
};

export const updateUserSettings = async (newSettings) => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return false;

    const current      = await getUserSettings();
    const merged       = { ...current, ...newSettings };
    const mergedJson   = JSON.stringify(merged);
    const now          = new Date().toISOString();

    const db = getDb();
    await db.runAsync(
      `INSERT INTO user_settings (user_id, settings, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at`,
      [userId, mergedJson, now]
    );
    return true;
  } catch (error) {
    console.error('Error updating user settings:', error.message);
    return false;
  }
};
