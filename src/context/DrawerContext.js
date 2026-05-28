import React, { createContext, useState, useContext, useRef } from 'react';
import { Animated, Dimensions } from 'react-native';

const DrawerContext = createContext();

export const useDrawer = () => useContext(DrawerContext);

export const DrawerProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Content-fit width: "Planned Payments" (16 chars) + icon 24px + margin 15px + padding 32px ≈ 215px; add breathing room
  const drawerWidth = Math.min(270, Dimensions.get('window').width * 0.72);
  const slideAnim = useRef(new Animated.Value(-drawerWidth)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openDrawer = () => {
    setIsOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -drawerWidth,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setIsOpen(false));
  };

  const toggleDrawer = () => {
    if (isOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  };

  return (
    <DrawerContext.Provider value={{ isOpen, openDrawer, closeDrawer, toggleDrawer, slideAnim, overlayAnim, drawerWidth }}>
      {children}
    </DrawerContext.Provider>
  );
};
