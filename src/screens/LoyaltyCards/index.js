import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { Coffee, Store, ShoppingBag, Fuel, Plus, ScanLine } from 'lucide-react-native';
import { styles } from './styles';

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

export default LoyaltyCards;
