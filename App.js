import 'react-native-url-polyfill/auto'
import React, { useState, useEffect } from 'react'
import { View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './src/lib/supabase'
import Auth from './src/components/Auth/index'
import AppNavigator from './src/navigation/AppNavigator'

export default function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  return (
    <SafeAreaProvider>
      {session && session.user ? (
        <NavigationContainer>
          <AppNavigator />
          <StatusBar style="light" />
        </NavigationContainer>
      ) : (
        <Auth />
      )}
    </SafeAreaProvider>
  )
}