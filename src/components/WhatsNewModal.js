import React from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { CHANGELOG, APP_VERSION } from '../constants/changelog';

const WhatsNewModal = ({ visible, onDismiss }) => {
  const { colors: COLORS } = useTheme();
  const entry = CHANGELOG[0];

  if (!entry) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: COLORS.card }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: COLORS.border }]}>
            <View style={[styles.iconBadge, { backgroundColor: COLORS.primary + '22' }]}>
              <Sparkles color={COLORS.primary} size={22} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.title, { color: COLORS.text }]}>{entry.title}</Text>
              <Text style={[styles.version, { color: COLORS.textSecondary }]}>Version {APP_VERSION}</Text>
            </View>
          </View>

          {/* Feature list */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {entry.features.map((f, i) => (
              <View key={i} style={[styles.featureRow, { borderBottomColor: COLORS.border }]}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={[styles.featureText, { color: COLORS.text }]}>{f.text}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Dismiss button */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: COLORS.primary }]}
            onPress={onDismiss}
          >
            <Text style={styles.btnText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  version: {
    fontSize: 12,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  btn: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default WhatsNewModal;
