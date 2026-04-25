import { StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default StyleSheet.create({
    /* ── Root ── */
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 40,
    },

    /* ── Header / Logo ── */
    header: {
        alignItems: 'center',
        marginBottom: 12,
    },
    logoContainer: {
        width: 88,
        height: 88,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoInner: {
        width: 76,
        height: 76,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
        elevation: 14,
        zIndex: 2,
    },
    logoGlow: {
        position: 'absolute',
        width: 88,
        height: 88,
        borderRadius: 26,
        backgroundColor: COLORS.primary,
        opacity: 0.15,
    },
    logoText: {
        fontSize: 36,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -1,
    },

    /* ── Title ── */
    titleBlock: {
        alignItems: 'center',
        marginBottom: 28,
    },
    title: {
        fontSize: 30,
        fontWeight: '800',
        color: COLORS.text,
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 15,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 21,
    },

    /* ── Tab Switcher ── */
    tabContainer: {
        marginBottom: 24,
    },
    tabBackground: {
        flexDirection: 'row',
        backgroundColor: COLORS.card,
        borderRadius: 14,
        padding: 4,
        position: 'relative',
    },
    tabIndicator: {
        position: 'absolute',
        top: 4,
        left: 4,
        height: '100%',
        borderRadius: 11,
        backgroundColor: COLORS.primary,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        zIndex: 1,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    tabTextActive: {
        color: '#fff',
    },

    /* ── Form Card ── */
    formCard: {
        backgroundColor: COLORS.card + 'aa',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#ffffff0d',
    },

    /* ── Input ── */
    inputContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textSecondary,
        marginBottom: 7,
        marginLeft: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#ffffff10',
        paddingHorizontal: 14,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 15,
        color: COLORS.text,
    },
    eyeButton: {
        padding: 4,
    },

    /* ── Password Strength ── */
    strengthContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingHorizontal: 2,
    },
    strengthBarTrack: {
        flexDirection: 'row',
        flex: 1,
        gap: 4,
    },
    strengthBarSegment: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    strengthLabel: {
        fontSize: 11,
        fontWeight: '700',
        marginLeft: 10,
        letterSpacing: 0.3,
    },

    /* ── Error Hint ── */
    errorHint: {
        color: COLORS.error,
        fontSize: 12,
        fontWeight: '500',
        marginTop: 6,
        marginLeft: 4,
    },

    /* ── Primary Button ── */
    primaryButton: {
        flexDirection: 'row',
        backgroundColor: COLORS.primary,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 6,
    },
    buttonDisabled: {
        opacity: 0.55,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    /* ── Divider ── */
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#ffffff12',
    },
    dividerText: {
        color: COLORS.textSecondary,
        fontSize: 13,
        fontWeight: '500',
        marginHorizontal: 14,
    },

    /* ── Google Button ── */
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 14,
        paddingVertical: 14,
        borderWidth: 1.5,
        borderColor: '#ffffff15',
    },
    googleIconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    googleG: {
        fontSize: 15,
        fontWeight: '800',
        color: '#4285F4',
    },
    googleButtonText: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: '600',
    },

    /* ── Footer ── */
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 28,
    },
    footerText: {
        color: COLORS.textSecondary,
        fontSize: 11,
        opacity: 0.6,
        letterSpacing: 0.2,
    },
});
