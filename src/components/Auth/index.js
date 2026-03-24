import * as Linking from 'expo-linking'
import React, { useState } from 'react'
import { Alert, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react-native'
import styles from './styles'

export default function Auth() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    async function signInWithEmail() {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.')
            return
        }
        setLoading(true)
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        })

        if (error) Alert.alert('Error', error.message)
        setLoading(false)
    }

    async function signUpWithEmail() {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.')
            return
        }
        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters.')
            return
        }
        setLoading(true)
        const {
            data: { session },
            error,
        } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                emailRedirectTo: Linking.createURL('home'),
            },
        })

        if (error) Alert.alert('Error', error.message)
        if (!session && !error) Alert.alert('Success', 'Please check your inbox for email verification!')
        setLoading(false)
    }

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Text style={styles.logoText}>PKR</Text>
                    </View>
                    <Text style={styles.title}>Wallet App</Text>
                    <Text style={styles.subtitle}>Manage your finances with ease</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Email Address</Text>
                        <View style={styles.inputWrapper}>
                            <Mail color={COLORS.textSecondary} size={20} style={styles.inputIcon} />
                            <TextInput
                                onChangeText={(text) => setEmail(text)}
                                value={email}
                                placeholder="email@address.com"
                                placeholderTextColor={COLORS.textSecondary + '80'}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={styles.input}
                            />
                        </View>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.inputWrapper}>
                            <Lock color={COLORS.textSecondary} size={20} style={styles.inputIcon} />
                            <TextInput
                                onChangeText={(text) => setPassword(text)}
                                value={password}
                                secureTextEntry={true}
                                placeholder="Min. 6 characters"
                                placeholderTextColor={COLORS.textSecondary + '80'}
                                autoCapitalize="none"
                                style={styles.input}
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.signInButton, loading && styles.buttonDisabled]}
                        onPress={() => signInWithEmail()}
                        disabled={loading}
                    >
                        {loading ? (
                            <Text style={styles.buttonText}>Processing...</Text>
                        ) : (
                            <>
                                <LogIn color="#fff" size={20} style={{ marginRight: 8 }} />
                                <Text style={styles.buttonText}>Sign In</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.signUpButton, loading && styles.buttonDisabled]}
                        onPress={() => signUpWithEmail()}
                        disabled={loading}
                    >
                        <UserPlus color={COLORS.primary} size={20} style={{ marginRight: 8 }} />
                        <Text style={styles.signUpButtonText}>Create New Account</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Secure authentication by Supabase</Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}
