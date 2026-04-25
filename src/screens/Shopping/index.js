import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { ShoppingCart, ShieldCheck, Plus, Search, Menu, CheckCircle2, Circle, Trash2, Edit2, Archive, CalendarDays } from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { styles } from './styles'; // Make sure this provides basic layout, we'll override some for the new UI

const AssetManager = () => {
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'archive' | 'warranty'
  
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState([]);
  const [archivedLists, setArchivedLists] = useState([]);
  const [warranties, setWarranties] = useState([]);

  // Modal states
  const [showListModal, setShowListModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showWarrantyModal, setShowWarrantyModal] = useState(false);

  // Form states
  const [editingId, setEditingId] = useState(null);
  const [listTitle, setListTitle] = useState('');
  
  const [selectedListId, setSelectedListId] = useState(null);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');

  const [warName, setWarName] = useState('');
  const [warPurchase, setWarPurchase] = useState(new Date());
  const [warExpiry, setWarExpiry] = useState(new Date(new Date().setFullYear(new Date().getFullYear() + 1)));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('purchase'); // 'purchase' | 'expiry'

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const [resLists, resWar] = await Promise.all([
        supabase.from('shopping_lists').select('*, shopping_items(*)').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('warranties').select('*').eq('user_id', userId).order('expiry_date', { ascending: true })
      ]);

      if (resLists.error) throw resLists.error;
      if (resWar.error) throw resWar.error;

      // Ensure shopping items are sorted by creation date inside the lists
      const processedLists = (resLists.data || []).map(l => ({
        ...l,
        shopping_items: (l.shopping_items || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      }));

      setLists(processedLists.filter(l => !l.is_archived));
      setArchivedLists(processedLists.filter(l => l.is_archived));
      setWarranties(resWar.data || []);

      checkWarrantyNotifications(resWar.data || []);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [userId]));

  const checkWarrantyNotifications = async (wars) => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    for (const w of wars) {
      if (!w.is_notified && w.expiry_date) {
        const expDate = new Date(w.expiry_date);
        if (expDate <= thirtyDaysFromNow && expDate >= today) {
          Alert.alert('Warranty Expiring Soon', `Your warranty for "${w.name}" is expiring on ${expDate.toLocaleDateString()}.`);
          await supabase.from('warranties').update({ is_notified: true }).eq('id', w.id);
        } else if (expDate < today) {
          Alert.alert('Warranty Expired', `Your warranty for "${w.name}" has expired.`);
          await supabase.from('warranties').update({ is_notified: true }).eq('id', w.id);
        }
      }
    }
  };

  // --- List Actions ---
  const saveList = async () => {
    if (!listTitle.trim()) return;
    if (editingId) {
      await supabase.from('shopping_lists').update({ title: listTitle }).eq('id', editingId);
    } else {
      await supabase.from('shopping_lists').insert({ user_id: userId, title: listTitle });
    }
    setShowListModal(false);
    setListTitle('');
    setEditingId(null);
    loadData();
  };

  const deleteList = async (id) => {
    Alert.alert('Delete List', 'Are you sure you want to permanently delete this list and all its items?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('shopping_lists').delete().eq('id', id);
          loadData();
      }}
    ]);
  };

  // --- Item Actions ---
  const saveItem = async () => {
    if (!itemName.trim() || !selectedListId) return;
    if (editingId) {
      await supabase.from('shopping_items').update({ name: itemName, description: itemDesc }).eq('id', editingId);
    } else {
      await supabase.from('shopping_items').insert({ list_id: selectedListId, name: itemName, description: itemDesc });
    }
    setShowItemModal(false);
    setItemName('');
    setItemDesc('');
    setEditingId(null);
    loadData();
  };

  const deleteItem = async (id) => {
    await supabase.from('shopping_items').delete().eq('id', id);
    loadData();
  };

  const toggleItem = async (listId, itemId, currentStatus) => {
    await supabase.from('shopping_items').update({ is_completed: !currentStatus }).eq('id', itemId);

    const targetList = lists.find(l => l.id === listId);
    if (!targetList) return;

    // Check if all items (including the one just toggled) are now complete
    const allCompleted = targetList.shopping_items.every(i => i.id === itemId ? !currentStatus : i.is_completed);

    if (allCompleted && targetList.shopping_items.length > 0) {
      Alert.alert('List Completed!', `Great job! "${targetList.title}" is fully completed. Moving to archive...`);
      await supabase.from('shopping_lists').update({ is_archived: true }).eq('id', listId);
    }
    loadData();
  };

  const unarchiveList = async (listId) => {
    await supabase.from('shopping_lists').update({ is_archived: false }).eq('id', listId);
    loadData();
  };

  // --- Warranty Actions ---
  const saveWarranty = async () => {
    if (!warName.trim()) return;
    const data = {
      user_id: userId,
      name: warName,
      purchase_date: warPurchase.toISOString().split('T')[0],
      expiry_date: warExpiry.toISOString().split('T')[0],
      color: COLORS.primary // default color
    };

    if (editingId) {
      await supabase.from('warranties').update(data).eq('id', editingId);
    } else {
      await supabase.from('warranties').insert(data);
    }
    setShowWarrantyModal(false);
    setWarName('');
    setEditingId(null);
    loadData();
  };

  const deleteWarranty = async (id) => {
    Alert.alert('Delete Warranty', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('warranties').delete().eq('id', id);
          loadData();
      }}
    ]);
  };

  // Render Helpers
  const renderTab = (key, icon, label) => (
    <TouchableOpacity 
      style={[styles.tab, activeTab === key && styles.activeTab]} 
      onPress={() => setActiveTab(key)}
    >
      {React.cloneElement(icon, { color: activeTab === key ? COLORS.primary : COLORS.textSecondary })}
      <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={{ marginRight: 16 }} onPress={openDrawer}>
          <Menu color={COLORS.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Asset Manager</Text>
      </View>

      <View style={styles.tabContainer}>
        {renderTab('active', <ShoppingCart size={20} />, 'Lists')}
        {renderTab('archive', <Archive size={20} />, 'Archive')}
        {renderTab('warranty', <ShieldCheck size={20} />, 'Warranties')}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 50 }} />
        ) : (
          <>
            {activeTab === 'active' && lists.map(list => (
              <View key={list.id} style={localStyles.listCard}>
                <View style={localStyles.listHeader}>
                  <Text style={localStyles.listTitle}>{list.title}</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => { setEditingId(list.id); setListTitle(list.title); setShowListModal(true); }}>
                      <Edit2 color={COLORS.textSecondary} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteList(list.id)}>
                      <Trash2 color={COLORS.error} size={18} />
                    </TouchableOpacity>
                  </View>
                </View>

                {list.shopping_items.map(item => (
                  <View key={item.id} style={localStyles.itemRow}>
                    <TouchableOpacity onPress={() => toggleItem(list.id, item.id, item.is_completed)}>
                      {item.is_completed ? <CheckCircle2 color={COLORS.success} size={22} /> : <Circle color={COLORS.textSecondary} size={22} />}
                    </TouchableOpacity>
                    <View style={localStyles.itemInfo}>
                      <Text style={[localStyles.itemName, item.is_completed && localStyles.itemCompleted]}>{item.name}</Text>
                      {item.description ? <Text style={localStyles.itemDesc}>{item.description}</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => { setSelectedListId(list.id); setEditingId(item.id); setItemName(item.name); setItemDesc(item.description); setShowItemModal(true); }}>
                      <Edit2 color={COLORS.textSecondary} size={16} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteItem(item.id)} style={{ marginLeft: 12 }}>
                      <Trash2 color={COLORS.error} size={16} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity 
                  style={localStyles.addItemBtn} 
                  onPress={() => { setSelectedListId(list.id); setEditingId(null); setItemName(''); setItemDesc(''); setShowItemModal(true); }}
                >
                  <Plus color={COLORS.primary} size={16} style={{ marginRight: 6 }} />
                  <Text style={localStyles.addItemText}>Add Item</Text>
                </TouchableOpacity>
              </View>
            ))}

            {activeTab === 'archive' && archivedLists.map(list => (
              <View key={list.id} style={[localStyles.listCard, { opacity: 0.8 }]}>
                <View style={localStyles.listHeader}>
                  <Text style={localStyles.listTitle}>{list.title} (Archived)</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => unarchiveList(list.id)}>
                      <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>Unarchive</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteList(list.id)}>
                      <Trash2 color={COLORS.error} size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
                {list.shopping_items.map(item => (
                  <View key={item.id} style={localStyles.itemRow}>
                    <CheckCircle2 color={COLORS.success} size={22} />
                    <View style={localStyles.itemInfo}>
                      <Text style={[localStyles.itemName, localStyles.itemCompleted]}>{item.name}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            {activeTab === 'warranty' && warranties.map(war => (
              <View key={war.id} style={localStyles.warrantyCard}>
                <View style={localStyles.warHeader}>
                  <Text style={localStyles.warName}>{war.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => { 
                      setEditingId(war.id); 
                      setWarName(war.name); 
                      setWarPurchase(new Date(war.purchase_date)); 
                      setWarExpiry(new Date(war.expiry_date)); 
                      setShowWarrantyModal(true); 
                    }}>
                      <Edit2 color={COLORS.textSecondary} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteWarranty(war.id)}>
                      <Trash2 color={COLORS.error} size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={localStyles.warDate}>Purchased: {new Date(war.purchase_date).toLocaleDateString()}</Text>
                <Text style={[localStyles.warDate, { color: new Date(war.expiry_date) < new Date() ? COLORS.error : COLORS.success }]}>
                  Expires: {new Date(war.expiry_date).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Main FAB */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => {
          setEditingId(null);
          if (activeTab === 'active' || activeTab === 'archive') {
            setListTitle('');
            setShowListModal(true);
          } else {
            setWarName('');
            setWarPurchase(new Date());
            setWarExpiry(new Date(new Date().setFullYear(new Date().getFullYear() + 1)));
            setShowWarrantyModal(true);
          }
        }}
      >
        <Plus color={COLORS.text} size={24} />
      </TouchableOpacity>

      {/* Modals */}
      <Modal visible={showListModal} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <Text style={localStyles.modalTitle}>{editingId ? 'Edit List' : 'New List'}</Text>
            <TextInput style={localStyles.input} placeholder="List Title" placeholderTextColor={COLORS.textSecondary} value={listTitle} onChangeText={setListTitle} />
            <View style={localStyles.modalActions}>
              <TouchableOpacity onPress={() => setShowListModal(false)}><Text style={localStyles.btnCancel}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveList}><Text style={localStyles.btnSave}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showItemModal} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <Text style={localStyles.modalTitle}>{editingId ? 'Edit Item' : 'Add Item'}</Text>
            <TextInput style={localStyles.input} placeholder="Item Name" placeholderTextColor={COLORS.textSecondary} value={itemName} onChangeText={setItemName} />
            <TextInput style={localStyles.input} placeholder="Description (Optional)" placeholderTextColor={COLORS.textSecondary} value={itemDesc} onChangeText={setItemDesc} />
            <View style={localStyles.modalActions}>
              <TouchableOpacity onPress={() => setShowItemModal(false)}><Text style={localStyles.btnCancel}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveItem}><Text style={localStyles.btnSave}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showWarrantyModal} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <Text style={localStyles.modalTitle}>{editingId ? 'Edit Warranty' : 'Add Warranty'}</Text>
            <TextInput style={localStyles.input} placeholder="Item Name" placeholderTextColor={COLORS.textSecondary} value={warName} onChangeText={setWarName} />
            
            <TouchableOpacity style={localStyles.dateBtn} onPress={() => { setDatePickerMode('purchase'); setShowDatePicker(true); }}>
              <CalendarDays color={COLORS.primary} size={20} />
              <Text style={{ color: COLORS.text }}>Purchase: {warPurchase.toLocaleDateString()}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={localStyles.dateBtn} onPress={() => { setDatePickerMode('expiry'); setShowDatePicker(true); }}>
              <CalendarDays color={COLORS.primary} size={20} />
              <Text style={{ color: COLORS.text }}>Expiry: {warExpiry.toLocaleDateString()}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={datePickerMode === 'purchase' ? warPurchase : warExpiry}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    if (datePickerMode === 'purchase') setWarPurchase(selectedDate);
                    else setWarExpiry(selectedDate);
                  }
                }}
              />
            )}

            <View style={localStyles.modalActions}>
              <TouchableOpacity onPress={() => setShowWarrantyModal(false)}><Text style={localStyles.btnCancel}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveWarranty}><Text style={localStyles.btnSave}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const localStyles = {
  listCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 10,
  },
  listTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemName: { color: COLORS.text, fontSize: 16 },
  itemCompleted: { textDecorationLine: 'line-through', color: COLORS.textSecondary },
  itemDesc: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 8 },
  addItemText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  warrantyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary
  },
  warHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  warName: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  warDate: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.card, width: '100%', borderRadius: 20, padding: 24 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', color: COLORS.text, borderRadius: 10, padding: 12, marginBottom: 12 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 12, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 20 },
  btnCancel: { color: COLORS.textSecondary, fontSize: 16, fontWeight: 'bold' },
  btnSave: { color: COLORS.primary, fontSize: 16, fontWeight: 'bold' }
};

export default AssetManager;
