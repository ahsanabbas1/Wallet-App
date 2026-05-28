import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Delete, X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

const PIN_LENGTH = 4;

// mode: 'setup' | 'change' | 'verify'
// onSuccess(pin) — called with new pin when setup/change done, or no arg when verify done
// onCancel — called when user taps X
export default function PinSetupModal({ visible, mode = 'setup', onSuccess, onCancel, verifyFn }) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [stage, setStage]   = useState('first'); // 'first' | 'confirm' | 'verify'
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const reset = () => {
    setStage(mode === 'change' ? 'verify' : 'first');
    setFirstPin('');
    setPin('');
    setError('');
  };

  // Reset when modal opens
  React.useEffect(() => {
    if (visible) reset();
  }, [visible, mode]);

  const getTitle = () => {
    if (mode === 'verify') return 'Enter Current PIN';
    if (mode === 'change') {
      if (stage === 'verify')  return 'Enter Current PIN';
      if (stage === 'confirm') return 'Confirm New PIN';
      return 'Enter New PIN';
    }
    if (stage === 'confirm') return 'Confirm PIN';
    return 'Create PIN';
  };

  const getSubtitle = () => {
    if (stage === 'verify')  return 'Verify your identity to continue';
    if (stage === 'confirm') return 'Re-enter the PIN to confirm';
    return 'Choose a 4-digit PIN';
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

    if (newPin.length < PIN_LENGTH) return;

    if (stage === 'verify') {
      const ok = await verifyFn(newPin);
      if (ok) {
        if (mode === 'verify') {
          onSuccess && onSuccess();
        } else {
          setStage('first');
          setPin('');
        }
      } else {
        shake();
        setError('Incorrect PIN');
        setTimeout(() => setPin(''), 600);
      }
      return;
    }

    if (stage === 'first') {
      setFirstPin(newPin);
      setStage('confirm');
      setTimeout(() => setPin(''), 200);
      return;
    }

    if (stage === 'confirm') {
      if (newPin === firstPin) {
        onSuccess && onSuccess(newPin);
      } else {
        shake();
        setError('PINs do not match. Try again.');
        setTimeout(() => {
          setFirstPin('');
          setStage('first');
          setPin('');
        }, 700);
      }
    }
  };

  const handleDelete = () => {
    setPin(p => p.slice(0, -1));
    setError('');
  };

  const keys = ['1','2','3','4','5','6','7','8','9','','0','del'];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <SafeAreaView style={styles.container}>
        {/* Close */}
        <Pressable style={styles.closeBtn} onPress={onCancel}>
          <X color={COLORS.textSecondary} size={24} />
        </Pressable>

        <View style={styles.topSection}>
          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>{getSubtitle()}</Text>
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
      </SafeAreaView>
    </Modal>
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
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 24,
    padding: 8,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
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
  },
  dotError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    marginBottom: 12,
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
});
