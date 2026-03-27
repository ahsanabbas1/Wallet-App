import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { ShoppingCart, ShieldCheck, Laptop, Refrigerator, ChevronRight, Plus, Search, Menu } from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { styles } from './styles';

const Shopping = () => {
  const { openDrawer } = useDrawer();
  const [activeTab, setActiveTab] = useState('shopping');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={{ marginRight: 16 }}
          onPress={openDrawer}
        >
          <Menu color={COLORS.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Asset Manager</Text>
        <TouchableOpacity style={styles.iconButton}>
          <Search color={COLORS.text} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'shopping' && styles.activeTab]} 
          onPress={() => setActiveTab('shopping')}
        >
          <ShoppingCart color={activeTab === 'shopping' ? COLORS.primary : COLORS.textSecondary} size={20} />
          <Text style={[styles.tabText, activeTab === 'shopping' && styles.activeTabText]}>Shopping List</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'warranty' && styles.activeTab]} 
          onPress={() => setActiveTab('warranty')}
        >
          <ShieldCheck color={activeTab === 'warranty' ? COLORS.primary : COLORS.textSecondary} size={20} />
          <Text style={[styles.tabText, activeTab === 'warranty' && styles.activeTabText]}>Warranties</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'shopping' ? (
          <>
            <SectionHeader title="Groceries" count={5} />
            <ShoppingItem label="Organic Milk" sub="2 Liters • Whole Foods" />
            <ShoppingItem label="Avocados" sub="Bag of 5 • Farmers Market" />
            <ShoppingItem label="Greek Yogurt" sub="500g • FreshMart" />

            <SectionHeader title="Household" count={3} />
            <ShoppingItem label="Laundry Detergent" sub="3L • EcoClean" />
            <ShoppingItem label="Paper Towels" sub="6 Pack • BulkStore" />
          </>
        ) : (
          <>
            <SectionHeader title="Active Protections" />
            <WarrantyItem 
              icon={Laptop} 
              name="MacBook Pro M2" 
              date="Purchased Jan 12, 2023" 
              status="Valid for 24 months" 
              color="#607D8B"
            />
            <WarrantyItem 
              icon={Refrigerator} 
              name="Samsung Refrigerator" 
              date="Purchased May 24, 2021" 
              status="Extended Warranty Active" 
              color="#00BCD4"
            />
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab}>
        <Plus color={COLORS.text} size={24} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const SectionHeader = ({ title, count }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {count !== undefined && <Text style={styles.sectionCount}>{count} items</Text>}
  </View>
);

const ShoppingItem = ({ label, sub }) => (
  <TouchableOpacity style={styles.listItem}>
    <View style={styles.checkbox} />
    <View style={styles.itemInfo}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={styles.itemSub}>{sub}</Text>
    </View>
    <ChevronRight color={COLORS.textSecondary} size={18} />
  </TouchableOpacity>
);

const WarrantyItem = ({ icon: Icon, name, date, status, color }) => (
  <View style={styles.warrantyCard}>
    <View style={[styles.warrantyIcon, { backgroundColor: color + '20' }]}>
      <Icon color={color} size={24} />
    </View>
    <View style={styles.warrantyInfo}>
      <Text style={styles.warrantyName}>{name}</Text>
      <Text style={styles.warrantyDate}>{date}</Text>
      <View style={styles.statusBadge}>
        <Text style={[styles.statusText, { color: color }]}>{status}</Text>
      </View>
    </View>
    <TouchableOpacity style={styles.detailsButton}>
      <Text style={styles.detailsButtonText}>Details</Text>
    </TouchableOpacity>
  </View>
);

export default Shopping;
