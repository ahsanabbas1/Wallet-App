import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Fingerprint, Delete } from 'lucide-react-native';
import { useLock } from '../../context/LockContext';
import { useTheme } from '../../context/ThemeContext';

const PIN_LENGTH = 4;

export default function LockScreen() {
  const { verifyPin, authWithBiometric, unlock, isBiometricEnabled, hasBiometricHW } = useLock();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const showBiometric = isBiometricEnabled && hasBiometricHW;

  useEffect(() => {
    if (showBiometric) tryBiometric();
  }, []);

  const tryBiometric = async () => {
    const ok = await authWithBiometric();
    if (ok) unlock();
  };

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const handleDigit = async (digit) => {
    if (pin.length >= PIN_LENGTH) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');

    if (newPin.length === PIN_LENGTH) {
      const ok = await verifyPin(newPin);
      if (ok) {
        unlock();
      } else {
        shake();
        setError('Incorrect PIN');
        setTimeout(() => setPin(''), 600);
      }
    }
  };

  const handleDelete = () => {
    setPin(p => p.slice(0, -1));
    setError('');
  };

  const keys = ['1','2','3','4','5','6','7','8','9','','0','del'];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.topSection}>
        <View style={styles.iconBadge}>
          <Lock color={COLORS.primary} size={32} />
        </View>
        <Text style={styles.title}>Wallet</Text>
        <Text style={styles.subtitle}>Enter your PIN to continue</Text>
      </View>

      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length ? styles.dotFilled : styles.dotEmpty,
              error ? styles.dotError : null,
            ]}
          />
        ))}
      </Animated.View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.keypad}>
        {keys.map((k, i) => {
          if (k === '') return <View key={i} style={styles.keyPlaceholder} />;
          if (k === 'del') {
            return (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                onPress={handleDelete}
              >
                <Delete color={COLORS.text} size={22} />
              </Pressable>
            );
          }
          return (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              onPress={() => handleDigit(k)}
            >
              <Text style={styles.keyText}>{k}</Text>
            </Pressable>
          );
        })}
      </View>

      {showBiometric && (
        <Pressable style={styles.bioBtn} onPress={tryBiometric}>
          <Fingerprint color={COLORS.primary} size={28} />
          <Text style={styles.bioBtnText}>Use Biometrics</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dotEmpty: {
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: COLORS.primary,
    borderWidth: 0,
  },
  dotError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    marginBottom: 16,
    marginTop: 4,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 270,
    marginTop: 32,
    gap: 12,
  },
  key: {
    width: 82,
    height: 72,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  keyPressed: {
    backgroundColor: COLORS.surface,
    opacity: 0.7,
  },
  keyPlaceholder: {
    width: 82,
    height: 72,
  },
  keyText: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '500',
  },
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
    padding: 12,
  },
  bioBtnText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '500',
  },
});
