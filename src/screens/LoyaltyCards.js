import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../constants/theme';
import { Coffee, Store, ShoppingBag, Fuel, Plus, ScanLine, ChevronRight } from 'lucide-react-native';

const LoyaltyCards = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Loyalty Cards</Text>
          <TouchableOpacity style={styles.scanButton}>
            <ScanLine color={COLORS.text} size={20} />
            <Text style={styles.scanButtonText}>Scan</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Your Rewards</Text>
        
        <View style={styles.cardsGrid}>
          <RewardCard 
            icon={Coffee} 
            name="Brew & Bean" 
            sub="Local Coffee Shop" 
            mainStat="8/10" 
            unit="Cups" 
            footer="2 more cups for a free drink!" 
            color="#795548"
            progress={0.8}
          />
          <RewardCard 
            icon={Store} 
            name="FreshMart" 
            sub="Grocery Store" 
            mainStat="1,240" 
            unit="Pts" 
            footer="PKR 12.40 Value" 
            color="#4CAF50"
            progress={0.6}
          />
          <RewardCard 
            icon={ShoppingBag} 
            name="Urban Thread" 
            sub="Fashion & Apparel" 
            mainStat="450" 
            unit="Pts" 
            footer="550 pts until next PKR 10 voucher" 
            color="#E91E63"
            progress={0.45}
          />
          <RewardCard 
            icon={Fuel} 
            name="Gas-Go" 
            sub="Fuel & Convenience" 
            mainStat="125" 
            unit="Liters" 
            footer="5¢/L Discount Active" 
            color="#03A9F4"
            progress={0.25}
          />
        </View>

        <TouchableOpacity style={styles.addCardButton}>
          <Plus color={COLORS.textSecondary} size={24} />
          <Text style={styles.addCardText}>Add a new loyalty card</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const RewardCard = ({ icon: Icon, name, sub, mainStat, unit, footer, color, progress }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Icon color={color} size={24} />
      </View>
      <View style={styles.cardNames}>
        <Text style={styles.cardName}>{name}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
      </View>
    </View>
    
    <View style={styles.statContainer}>
      <Text style={[styles.statValue, { color: color }]}>{mainStat}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>

    <View style={styles.progressContainer}>
      <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: color }]} />
    </View>

    <Text style={styles.footerText}>{footer}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SIZES.padding,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  scanButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  cardsGrid: {
    gap: 16,
    marginBottom: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardNames: {
    flex: 1,
  },
  cardName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  statContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
    gap: 6,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  statUnit: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  progressContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: 12,
    marginBottom: 40,
  },
  addCardText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});

export default LoyaltyCards;
