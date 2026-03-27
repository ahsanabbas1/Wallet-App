import { supabase } from './supabase';

/**
 * Fetches the user settings for the currently authenticated user.
 * @returns {Promise<Object>} The settings object, or default {} if none exist.
 */
export const getUserSettings = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return {};

    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No settings row found, return empty default
        return {};
      }
      throw error;
    }

    return data?.settings || {};
  } catch (error) {
    console.warn('Error fetching user settings:', error.message);
    return {};
  }
};

/**
 * Updates or creates the user settings for the currently authenticated user.
 * @param {Object} newSettings - The new settings partial object to merge.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export const updateUserSettings = async (newSettings) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    // First fetch existing settings to deeply merge
    const currentSettings = await getUserSettings();
    const mergedSettings = { ...currentSettings, ...newSettings };

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: session.user.id,
        settings: mergedSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating user settings:', error.message);
    return false;
  }
};
