import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Mail, Github, Globe, Heart, Shield, Zap, Layout, BarChart, Smartphone } from 'lucide-react-native';
import { COLORS, SIZES } from '../../constants/theme';

const FeatureItem = ({ icon: Icon, title, description }) => (
  <View style={styles.featureItem}>
    <View style={styles.featureIconContainer}>
      <Icon color={COLORS.primary} size={22} />
    </View>
    <View style={styles.featureTextContainer}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

const About = ({ navigation }) => {
  const handleEmail = () => {
    Linking.openURL('mailto:AhsanAbbas1991@gmail.com');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={COLORS.text} size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>About App</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* App Logo & Name */}
        <View style={styles.appSection}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/wallet-budget-app.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>Wallet Budget App</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
        </View>

        {/* Developer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Owner & Developer</Text>
          <View style={styles.card}>
            <View style={styles.devInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>AA</Text>
              </View>
              <View>
                <Text style={styles.devName}>Ahsan Abbas</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Pressable
              style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.6 }]}
              onPress={handleEmail}
            >
              <Mail color={COLORS.primary} size={20} />
              <Text style={styles.contactText}>AhsanAbbas1991@gmail.com</Text>
            </Pressable>
          </View>
        </View>

        {/* App Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What the App Does</Text>
          <View style={styles.card}>
            <Text style={styles.description}>
              Wallet Budget App is a premium financial management tool designed to help you take full control of your money.
              Track every expense, set realistic budgets, and gain deep insights into your spending habits with ease.
            </Text>
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cool Features</Text>
          <FeatureItem
            icon={Layout}
            title="Hierarchical Categories"
            description="Organize transactions with a professional multi-level category system."
          />
          <FeatureItem
            icon={Zap}
            title="AI Assistant"
            description="Get personalized financial advice and insights from our built-in AI."
          />
          <FeatureItem
            icon={BarChart}
            title="Advanced Reports"
            description="Visualize your financial health with beautiful charts and data analytics."
          />
          <FeatureItem
            icon={Shield}
            title="Secure Sync"
            description="Your data is safely stored and synced across devices using Supabase."
          />
          <FeatureItem
            icon={Smartphone}
            title="Premium UI"
            description="A sleek, dark-themed interface designed for the best user experience."
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Heart color={COLORS.error} size={16} fill={COLORS.error} />
          <Text style={styles.footerText}>Made with passion for financial freedom</Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 16,
  },
  backBtn: {
    padding: 8,
    backgroundColor: COLORS.card,
    borderRadius: 12,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  scroll: {
    padding: SIZES.padding,
  },
  appSection: {
    alignItems: 'center',
    marginVertical: 24,
  },
  logoContainer: {
    width: 100,
    height: 100,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 12,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  appName: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  appVersion: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
  },
  devInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  devName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  devTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactText: {
    color: COLORS.text,
    fontSize: 14,
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  featureItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    gap: 16,
    alignItems: 'center',
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});

export default About;
