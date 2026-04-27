import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import React, { useState, useRef, useEffect, useMemo } from 'react'

WebBrowser.maybeCompleteAuthSession()
import {
    Alert,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Animated,
    ActivityIndicator,
    Dimensions,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { Mail, Lock, LogIn, UserPlus, Eye, EyeOff, User, Shield, ArrowRight } from 'lucide-react-native'
import { useTheme } from '../../context/ThemeContext'
import { makeStyles } from './styles'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const GoogleIcon = () => (
    <View style={styles.googleIconContainer}>
        <Text style={styles.googleG}>G</Text>
    </View>
)

// Password strength helper
const getPasswordStrength = (password) => {
    if (!password) return { level: 0, label: '', color: 'transparent' }
    let score = 0
    if (password.length >= 6) score++
    if (password.length >= 10) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 1) return { level: 1, label: 'Weak', color: COLORS.error }
    if (score <= 2) return { level: 2, label: 'Fair', color: COLORS.warning }
    if (score <= 3) return { level: 3, label: 'Good', color: '#f0c420' }
    if (score <= 4) return { level: 4, label: 'Strong', color: COLORS.success }
    return { level: 5, label: 'Very Strong', color: '#00e676' }
}

export default function Auth() {
    const { colors: COLORS } = useTheme()
    const styles = useMemo(() => makeStyles(COLORS), [COLORS])
    const [activeTab, setActiveTab] = useState('login') // 'login' | 'register'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    // Animation values
    const tabIndicatorAnim = useRef(new Animated.Value(0)).current
    const formOpacity = useRef(new Animated.Value(1)).current
    const formTranslateY = useRef(new Animated.Value(0)).current
    const logoScale = useRef(new Animated.Value(0)).current
    const headerFade = useRef(new Animated.Value(0)).current

    // Entrance animation
    useEffect(() => {
        Animated.sequence([
            Animated.spring(logoScale, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
            Animated.timing(headerFade, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start()
    }, [])

    const switchTab = (tab) => {
        if (tab === activeTab) return

        // Animate out
        Animated.parallel([
            Animated.timing(formOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
            Animated.timing(formTranslateY, { toValue: 10, duration: 150, useNativeDriver: true }),
        ]).start(() => {
            setActiveTab(tab)
            // Reset form fields when switching
            setEmail('')
            setPassword('')
            setFullName('')
            setConfirmPassword('')
            setShowPassword(false)
            setShowConfirmPassword(false)

            // Animate tab indicator
            Animated.spring(tabIndicatorAnim, {
                toValue: tab === 'login' ? 0 : 1,
                tension: 80,
                friction: 10,
                useNativeDriver: true,
            }).start()

            // Animate in
            Animated.parallel([
                Animated.timing(formOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(formTranslateY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
            ]).start()
        })
    }

    async function signInWithEmail() {
        if (!email || !password) {
            Alert.alert('Missing Fields', 'Please enter both email and password.')
            return
        }
        setLoading(true)
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        if (error) Alert.alert('Sign In Failed', error.message)
        setLoading(false)
    }

    async function signUpWithEmail() {
        if (!fullName.trim()) {
            Alert.alert('Missing Name', 'Please enter your full name.')
            return
        }
        if (!email || !password) {
            Alert.alert('Missing Fields', 'Please enter both email and password.')
            return
        }
        if (password.length < 6) {
            Alert.alert('Weak Password', 'Password must be at least 6 characters.')
            return
        }
        if (password !== confirmPassword) {
            Alert.alert('Password Mismatch', 'Passwords do not match.')
            return
        }
        setLoading(true)
        const {
            data: { session },
            error,
        } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: Linking.createURL('home'),
                data: {
                    full_name: fullName.trim(),
                },
            },
        })

        if (error) Alert.alert('Sign Up Failed', error.message)
        if (!session && !error)
            Alert.alert('Almost There!', 'Please check your email inbox to verify your account.')
        setLoading(false)
    }

    async function signInWithGoogle() {
        setGoogleLoading(true)
        try {
            // Create the redirect URL to return to the app
            const redirectUrl = Linking.createURL('home')
            
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true, // Do not auto-redirect; handle it manually with WebBrowser
                },
            })

            if (error) {
                Alert.alert('Google Sign-In Failed', error.message)
            } else if (data?.url) {
                // Open auth session and wait for result
                const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
                
                if (res.type === 'success' && res.url) {
                    // Extract the session info from the return URL
                    try {
                        const urlParts = res.url.split('#');
                        if (urlParts.length > 1) {
                            const params = new URLSearchParams(urlParts[1]);
                            const access_token = params.get('access_token');
                            const refresh_token = params.get('refresh_token');

                            if (access_token && refresh_token) {
                                const { error: sessionError } = await supabase.auth.setSession({
                                    access_token,
                                    refresh_token
                                });
                                if (sessionError) {
                                    Alert.alert('Sign-in Error', sessionError.message);
                                }
                            } else {
                                // Fallback
                                await supabase.auth.getSessionFromUrl(res.url);
                            }
                        } else {
                            // URL might have query params instead of hash in some error cases
                            const queryParts = res.url.split('?');
                            if (queryParts.length > 1) {
                                const params = new URLSearchParams(queryParts[1]);
                                const errorDesc = params.get('error_description') || params.get('error');
                                if (errorDesc) {
                                    Alert.alert('Sign-in Error', decodeURIComponent(errorDesc).replace(/\+/g, ' '));
                                }
                            }
                            await supabase.auth.getSessionFromUrl(res.url);
                        }
                    } catch (e) {
                        console.error('Session parsing error:', e);
                    }
                }
            }
        } catch (err) {
            Alert.alert('Error', 'Could not connect to Google. Please try again.')
        }
        setGoogleLoading(false)
    }

    const passwordStrength = getPasswordStrength(password)
    const tabWidth = (SCREEN_WIDTH - 64) / 2 // 24px padding + 8px inner padding on each side

    const indicatorTranslateX = tabIndicatorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, tabWidth],
    })

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* ── Header / Logo ── */}
                <Animated.View style={[styles.header, { transform: [{ scale: logoScale }] }]}>
                    <View style={styles.logoContainer}>
                        <View style={styles.logoInner}>
                            <Text style={styles.logoText}>W</Text>
                        </View>
                        <View style={styles.logoGlow} />
                    </View>
                </Animated.View>

                <Animated.View style={[styles.titleBlock, { opacity: headerFade }]}>
                    <Text style={styles.title}>Wallet Budget App</Text>
                    <Text style={styles.subtitle}>
                        {activeTab === 'login'
                            ? 'Welcome back! Sign in to continue.'
                            : 'Create an account to get started.'}
                    </Text>
                </Animated.View>

                {/* ── Tab Switcher ── */}
                <View style={styles.tabContainer}>
                    <View style={styles.tabBackground}>
                        <Animated.View
                            style={[
                                styles.tabIndicator,
                                {
                                    width: tabWidth,
                                    transform: [{ translateX: indicatorTranslateX }],
                                },
                            ]}
                        />
                        <TouchableOpacity
                            style={styles.tab}
                            onPress={() => switchTab('login')}
                            activeOpacity={0.7}
                        >
                            <LogIn
                                color={activeTab === 'login' ? '#fff' : COLORS.textSecondary}
                                size={16}
                                style={{ marginRight: 6 }}
                            />
                            <Text
                                style={[
                                    styles.tabText,
                                    activeTab === 'login' && styles.tabTextActive,
                                ]}
                            >
                                Sign In
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.tab}
                            onPress={() => switchTab('register')}
                            activeOpacity={0.7}
                        >
                            <UserPlus
                                color={activeTab === 'register' ? '#fff' : COLORS.textSecondary}
                                size={16}
                                style={{ marginRight: 6 }}
                            />
                            <Text
                                style={[
                                    styles.tabText,
                                    activeTab === 'register' && styles.tabTextActive,
                                ]}
                            >
                                Register
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Form ── */}
                <Animated.View
                    style={[
                        styles.formCard,
                        { opacity: formOpacity, transform: [{ translateY: formTranslateY }] },
                    ]}
                >
                    {/* Register: Full Name */}
                    {activeTab === 'register' && (
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Full Name</Text>
                            <View style={styles.inputWrapper}>
                                <User color={COLORS.textSecondary} size={18} style={styles.inputIcon} />
                                <TextInput
                                    onChangeText={setFullName}
                                    value={fullName}
                                    placeholder="John Doe"
                                    placeholderTextColor={COLORS.textSecondary + '60'}
                                    autoCapitalize="words"
                                    style={styles.input}
                                />
                            </View>
                        </View>
                    )}

                    {/* Email */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Email Address</Text>
                        <View style={styles.inputWrapper}>
                            <Mail color={COLORS.textSecondary} size={18} style={styles.inputIcon} />
                            <TextInput
                                onChangeText={setEmail}
                                value={email}
                                placeholder="you@example.com"
                                placeholderTextColor={COLORS.textSecondary + '60'}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={styles.input}
                            />
                        </View>
                    </View>

                    {/* Password */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.inputWrapper}>
                            <Lock color={COLORS.textSecondary} size={18} style={styles.inputIcon} />
                            <TextInput
                                onChangeText={setPassword}
                                value={password}
                                secureTextEntry={!showPassword}
                                placeholder={activeTab === 'register' ? 'Min. 6 characters' : '••••••••'}
                                placeholderTextColor={COLORS.textSecondary + '60'}
                                autoCapitalize="none"
                                style={styles.input}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                {showPassword ? (
                                    <EyeOff color={COLORS.textSecondary} size={18} />
                                ) : (
                                    <Eye color={COLORS.textSecondary} size={18} />
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Password Strength Meter (register only) */}
                        {activeTab === 'register' && password.length > 0 && (
                            <View style={styles.strengthContainer}>
                                <View style={styles.strengthBarTrack}>
                                    {[1, 2, 3, 4, 5].map((seg) => (
                                        <View
                                            key={seg}
                                            style={[
                                                styles.strengthBarSegment,
                                                {
                                                    backgroundColor:
                                                        seg <= passwordStrength.level
                                                            ? passwordStrength.color
                                                            : COLORS.card,
                                                },
                                            ]}
                                        />
                                    ))}
                                </View>
                                <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                                    {passwordStrength.label}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Confirm Password (register only) */}
                    {activeTab === 'register' && (
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Confirm Password</Text>
                            <View style={styles.inputWrapper}>
                                <Shield color={COLORS.textSecondary} size={18} style={styles.inputIcon} />
                                <TextInput
                                    onChangeText={setConfirmPassword}
                                    value={confirmPassword}
                                    secureTextEntry={!showConfirmPassword}
                                    placeholder="Re-enter password"
                                    placeholderTextColor={COLORS.textSecondary + '60'}
                                    autoCapitalize="none"
                                    style={styles.input}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                    style={styles.eyeButton}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff color={COLORS.textSecondary} size={18} />
                                    ) : (
                                        <Eye color={COLORS.textSecondary} size={18} />
                                    )}
                                </TouchableOpacity>
                            </View>
                            {confirmPassword.length > 0 && password !== confirmPassword && (
                                <Text style={styles.errorHint}>Passwords do not match</Text>
                            )}
                        </View>
                    )}

                    {/* Primary CTA */}
                    <TouchableOpacity
                        style={[styles.primaryButton, loading && styles.buttonDisabled]}
                        onPress={activeTab === 'login' ? signInWithEmail : signUpWithEmail}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Text style={styles.primaryButtonText}>
                                    {activeTab === 'login' ? 'Sign In' : 'Create Account'}
                                </Text>
                                <ArrowRight color="#fff" size={20} style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>

                    {/* ── Divider ── */}
                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or continue with</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* ── Google Sign-In ── */}
                    <TouchableOpacity
                        style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
                        onPress={signInWithGoogle}
                        disabled={googleLoading}
                        activeOpacity={0.8}
                    >
                        {googleLoading ? (
                            <ActivityIndicator color={COLORS.text} size="small" />
                        ) : (
                            <>
                                <GoogleIcon />
                                <Text style={styles.googleButtonText}>
                                    {activeTab === 'login' ? 'Sign in with Google' : 'Sign up with Google'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                {/* ── Footer ── */}
                <View style={styles.footer}>
                    <Shield color={COLORS.textSecondary + '60'} size={14} style={{ marginRight: 6 }} />
                    <Text style={styles.footerText}>Secured by Supabase · End-to-end encrypted</Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}
