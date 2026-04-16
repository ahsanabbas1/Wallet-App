import 'react-native-url-polyfill/auto'
import React, { useState, useEffect } from 'react'
import { View } from 'react-native'

import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { DrawerProvider } from './src/context/DrawerContext'
import GlobalDrawer from './src/components/GlobalDrawer'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './src/lib/supabase'
import Auth from './src/components/Auth/index'
import AppNavigator from './src/navigation/AppNavigator'

export default function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        ensureUserProfile(session.user)
      }
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        ensureUserProfile(session.user)
      }
    })
  }, [])

  const ensureUserProfile = async (user) => {
    try {
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
      await supabase
        .from('users')
        .update({
          name: fullName,
          email: user.email,
        })
        .eq('id', user.id);
        
      // Try upsert if update didn't affect anything, but safer to assume profile exists or will be created on first login
      await supabase
        .from('users')
        .upsert({
          id: user.id,
          name: fullName,
          email: user.email,
        }, { onConflict: 'id' });
    } catch (e) {
      console.warn('Could not ensure user profile:', e.message)
    }
  }

  return (
    <SafeAreaProvider>
      {session && session.user ? (
        <DrawerProvider>
          <NavigationContainer>
            <AppNavigator />
            <GlobalDrawer />
            <StatusBar style="light" />
          </NavigationContainer>
        </DrawerProvider>
      ) : (
        <Auth />
      )}
    </SafeAreaProvider>
  )
}