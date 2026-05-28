import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const LockContext = createContext();
export const useLock = () => useContext(LockContext);

const KEYS = {
  PIN_ENABLED:       'lock_pin_enabled',
  BIOMETRIC_ENABLED: 'lock_biometric_enabled',
  LOCK_AFTER:        'lock_after_minutes',
};
const PIN_KEY = 'app_pin';

export const LockProvider = ({ children }) => {
  const [isLocked,           setIsLocked]           = useState(false);
  const [isPinEnabled,       setIsPinEnabled]       = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [lockAfter,          setLockAfterState]     = useState(1); // minutes; 0 = immediately
  const [hasBiometricHW,     setHasBiometricHW]     = useState(false);
  const [ready,              setReady]              = useState(false);
  const bgTime = useRef(null);

  // Load persisted settings once
  useEffect(() => {
    (async () => {
      try {
        const [pinEnabled, bioEnabled, lockAfterVal] = await Promise.all([
          AsyncStorage.getItem(KEYS.PIN_ENABLED),
          AsyncStorage.getItem(KEYS.BIOMETRIC_ENABLED),
          AsyncStorage.getItem(KEYS.LOCK_AFTER),
        ]);
        const pinOn = pinEnabled === 'true';
        setIsPinEnabled(pinOn);
        setIsBiometricEnabled(bioEnabled === 'true');
        setLockAfterState(lockAfterVal != null ? parseInt(lockAfterVal, 10) : 1);
        if (pinOn) setIsLocked(true);

        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled   = await LocalAuthentication.isEnrolledAsync();
        setHasBiometricHW(compatible && enrolled);
      } catch (_) {}
      setReady(true);
    })();
  }, []);

  // AppState — lock when returning from background after lockAfter minutes
  useEffect(() => {
    if (!ready) return;
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background' || next === 'inactive') {
        bgTime.current = Date.now();
      } else if (next === 'active') {
        if (isPinEnabled && bgTime.current != null) {
          const elapsedMin = (Date.now() - bgTime.current) / 60000;
          if (elapsedMin >= lockAfter) setIsLocked(true);
        }
        bgTime.current = null;
      }
    });
    return () => sub.remove();
  }, [ready, isPinEnabled, lockAfter]);

  const unlock  = () => setIsLocked(false);
  const lockApp = () => { if (isPinEnabled) setIsLocked(true); };

  const verifyPin = async (pin) => {
    try {
      const stored = await SecureStore.getItemAsync(PIN_KEY);
      return stored === pin;
    } catch { return false; }
  };

  const savePin = async (pin) => {
    await SecureStore.setItemAsync(PIN_KEY, pin);
    await AsyncStorage.setItem(KEYS.PIN_ENABLED, 'true');
    setIsPinEnabled(true);
    setIsLocked(false);
  };

  const removePin = async () => {
    try { await SecureStore.deleteItemAsync(PIN_KEY); } catch (_) {}
    await AsyncStorage.multiRemove([KEYS.PIN_ENABLED, KEYS.BIOMETRIC_ENABLED]);
    setIsPinEnabled(false);
    setIsBiometricEnabled(false);
    setIsLocked(false);
  };

  const setBiometric = async (enabled) => {
    await AsyncStorage.setItem(KEYS.BIOMETRIC_ENABLED, String(enabled));
    setIsBiometricEnabled(enabled);
  };

  const setLockAfter = async (minutes) => {
    await AsyncStorage.setItem(KEYS.LOCK_AFTER, String(minutes));
    setLockAfterState(minutes);
  };

  const authWithBiometric = async () => {
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Wallet',
        cancelLabel:   'Use PIN',
        disableDeviceFallback: true,
      });
      return res.success;
    } catch { return false; }
  };

  return (
    <LockContext.Provider value={{
      isLocked, isPinEnabled, isBiometricEnabled, lockAfter,
      hasBiometricHW, ready,
      unlock, lockApp, verifyPin, savePin, removePin,
      setBiometric, setLockAfter, authWithBiometric,
    }}>
      {children}
    </LockContext.Provider>
  );
};
