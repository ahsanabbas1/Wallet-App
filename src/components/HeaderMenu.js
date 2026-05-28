import React, { useState, useRef } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet,
  TouchableWithoutFeedback, Platform,
} from 'react-native';
import { MoreVertical } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

// items: [{ icon: LucideIcon, label: string, onPress: fn, danger?: bool }]
export default function HeaderMenu({ items, iconColor }) {
  const { colors: COLORS } = useTheme();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 60, right: 12 });
  const btnRef = useRef(null);

  const handleOpen = () => {
    btnRef.current?.measure((_fx, _fy, _w, h, _px, py) => {
      setMenuPos({ top: py + h + 4, right: 12 });
    });
    setOpen(true);
  };

  const handlePress = (item) => {
    setOpen(false);
    setTimeout(() => item.onPress(), 150);
  };

  return (
    <>
      <Pressable
        ref={btnRef}
        onPress={handleOpen}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
        hitSlop={8}
      >
        <MoreVertical color={iconColor || COLORS.textSecondary} size={22} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={StyleSheet.absoluteFill}>
            <TouchableWithoutFeedback>
              <View style={[styles.menu(COLORS), { top: menuPos.top, right: menuPos.right }]}>
                {items.map((item, i) => (
                  <Pressable
                    key={i}
                    style={({ pressed }) => [
                      styles.item,
                      i < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.border },
                      pressed && { backgroundColor: COLORS.surface },
                    ]}
                    onPress={() => handlePress(item)}
                  >
                    <item.icon
                      color={item.danger ? COLORS.error : COLORS.textSecondary}
                      size={17}
                    />
                    <Text style={[
                      styles.label,
                      { color: item.danger ? COLORS.error : COLORS.text },
                    ]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = {
  btn: {
    padding: 6,
    borderRadius: 10,
  },
  menu: (COLORS) => ({
    position: 'absolute',
    minWidth: 190,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  }),
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
};
