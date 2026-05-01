import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { makeStyles } from './styles';
import {
  ShoppingCart, ShieldCheck, Plus, Menu, CheckCircle2, Circle,
  Trash2, Edit2, Archive, CalendarDays, Tag, Package
} from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { shoppingService } from '../../services/shoppingService';

const ShoppingList = () => {
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const { currency: userCurrency } = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  // Inline style map — recomputes only when COLORS changes (theme switch)
  const S = useMemo(() => ({
    listCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16 },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider, paddingBottom: 10 },
    listTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
    listMeta: { color: COLORS.textSecondary, fontSize: 12 },
    itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    itemInfo: { flex: 1, marginLeft: 12 },
    itemName: { color: COLORS.text, fontSize: 15, fontWeight: '500' },
    itemDone: { textDecorationLine: 'line-through', color: COLORS.textSecondary },
    itemMeta: { color: COLORS.textSecondary, fontSize: 11 },
    addItemBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 8, gap: 6 },
    addItemText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
    warrantyCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16, borderLeftWidth: 4 },
    warHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    warName: { color: COLORS.text, fontSize: 17, fontWeight: 'bold' },
    warDate: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 4 },
    emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: COLORS.card, borderRadius: 20 },
    emptyTitle: { color: COLORS.text, fontSize: 17, fontWeight: 'bold' },
    emptyText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 6 },
    overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalBox: { backgroundColor: COLORS.card, width: '100%', borderRadius: 20, padding: 24 },
    modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
    fieldLabel: { color: COLORS.textSecondary, fontSize: 11, marginBottom: 4, fontWeight: '600' },
    input: { backgroundColor: COLORS.inputBg, color: COLORS.text, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
    dateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, marginBottom: 12 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 20 },
    btnCancel: { color: COLORS.textSecondary, fontSize: 16, fontWeight: 'bold' },
    btnSave: { color: COLORS.primary, fontSize: 16, fontWeight: 'bold' },
  }), [COLORS]);

  const [activeTab, setActiveTab] = useState('active');
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
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('');

  const [warName, setWarName] = useState('');
  const [warPurchase, setWarPurchase] = useState(new Date());
  const [warExpiry, setWarExpiry] = useState(new Date(new Date().setFullYear(new Date().getFullYear() + 1)));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('purchase');

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [allLists, allWarranties] = await Promise.all([
        shoppingService.getLists(userId),
        shoppingService.getWarranties(userId),
      ]);

      const processed = allLists.map(l => ({
        ...l,
        shopping_items: (l.shopping_items || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
      }));

      setLists(processed.filter(l => !l.is_archived));
      setArchivedLists(processed.filter(l => l.is_archived));
      setWarranties(allWarranties);
      checkWarrantyNotifications(allWarranties);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [userId]));

  // ── Warranty notifications ────────────────────────────────────────────────────

  const checkWarrantyNotifications = async (wars) => {
    const today = new Date();
    const thirtyDays = new Date();
    thirtyDays.setDate(today.getDate() + 30);
    for (const w of wars) {
      if (!w.is_notified && w.expiry_date) {
        const exp = new Date(w.expiry_date);
        if (exp < today) {
          Alert.alert('Warranty Expired', `"${w.name}" warranty has expired.`);
          shoppingService.updateWarrantyNotified(w.id).catch(() => {});
        } else if (exp <= thirtyDays) {
          Alert.alert('Warranty Expiring Soon', `"${w.name}" expires on ${exp.toLocaleDateString()}.`);
          shoppingService.updateWarrantyNotified(w.id).catch(() => {});
        }
      }
    }
  };

  // ── List actions ──────────────────────────────────────────────────────────────

  const saveList = async () => {
    if (!listTitle.trim()) return;
    try {
      await shoppingService.saveList(userId, {
        id: editingId || undefined,
        title: listTitle.trim(),
      });
      setShowListModal(false);
      setListTitle(''); setEditingId(null);
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const deleteList = async (id) => {
    Alert.alert('Delete List', 'Permanently delete this list and all its items?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await shoppingService.deleteList(userId, id);
            loadData();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        }
      }
    ]);
  };

  const unarchiveList = async (id) => {
    try {
      await shoppingService.archiveList(userId, id, false);
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // ── Item actions ──────────────────────────────────────────────────────────────

  const saveItem = async () => {
    if (!itemName.trim() || !selectedListId) return;
    try {
      await shoppingService.saveItem(selectedListId, {
        id: editingId || undefined,
        name: itemName.trim(),
        description: itemDesc.trim() || null,
        quantity: parseInt(itemQty) || 1,
        price: itemPrice ? parseFloat(itemPrice) : null,
      });
      setShowItemModal(false);
      setItemName(''); setItemDesc(''); setItemQty('1'); setItemPrice('');
      setEditingId(null);
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const deleteItem = async (id) => {
    try {
      await shoppingService.deleteItem(id);
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const toggleItem = async (listId, itemId, currentStatus) => {
    try {
      const { allDone } = await shoppingService.toggleItem(listId, itemId, currentStatus);
      if (allDone) {
        const targetList = lists.find(l => l.id === listId);
        if (targetList) Alert.alert('List Completed!', `"${targetList.title}" is done! Moving to archive.`);
      }
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // ── Warranty actions ──────────────────────────────────────────────────────────

  const saveWarranty = async () => {
    if (!warName.trim()) return;
    try {
      await shoppingService.saveWarranty(userId, {
        id: editingId || undefined,
        name: warName.trim(),
        purchase_date: warPurchase.toISOString().split('T')[0],
        expiry_date: warExpiry.toISOString().split('T')[0],
        color: COLORS.primary,
      });
      setShowWarrantyModal(false);
      setWarName(''); setEditingId(null);
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const deleteWarranty = async (id) => {
    Alert.alert('Delete', 'Delete this warranty?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await shoppingService.deleteWarranty(userId, id);
            loadData();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        }
      }
    ]);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const openItemModal = (listId, item = null) => {
    setSelectedListId(listId);
    setEditingId(item?.id || null);
    setItemName(item?.name || '');
    setItemDesc(item?.description || '');
    setItemQty(item?.quantity ? item.quantity.toString() : '1');
    setItemPrice(item?.price ? item.price.toString() : '');
    setShowItemModal(true);
  };

  const listTotalPrice = (items) => {
    const total = items.reduce((s, i) => {
      if (i.price && i.quantity) return s + (parseFloat(i.price) * parseInt(i.quantity));
      return s;
    }, 0);
    return total > 0 ? total : null;
  };

  const renderTab = (key, icon, label) => (
    <TouchableOpacity style={[styles.tab, activeTab === key && styles.activeTab]} onPress={() => setActiveTab(key)}>
      {React.cloneElement(icon, { color: activeTab === key ? COLORS.primary : COLORS.textSecondary, size: 18 })}
      <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>{label}</Text>
    </TouchableOpacity>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={{ width: 40 }} onPress={openDrawer}>
          <Menu color={COLORS.text} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Shopping List</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabContainer}>
        {renderTab('active', <ShoppingCart size={18} />, 'Lists')}
        {renderTab('archive', <Archive size={18} />, 'Archive')}
        {renderTab('warranty', <ShieldCheck size={18} />, 'Warranties')}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 50 }} />
        ) : (
          <>
            {/* Active Lists */}
            {activeTab === 'active' && (
              lists.length > 0 ? lists.map(list => {
                const total = listTotalPrice(list.shopping_items);
                const completedCount = list.shopping_items.filter(i => i.is_completed).length;
                return (
                  <View key={list.id} style={S.listCard}>
                    <View style={S.listHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={S.listTitle}>{list.title}</Text>
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                          <Text style={S.listMeta}>{completedCount}/{list.shopping_items.length} items</Text>
                          {total !== null && (
                            <Text style={S.listMeta}>Est. {userCurrency} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                          )}
                        </View>
                      </View>
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
                      <View key={item.id} style={S.itemRow}>
                        <TouchableOpacity onPress={() => toggleItem(list.id, item.id, item.is_completed)}>
                          {item.is_completed
                            ? <CheckCircle2 color={COLORS.success} size={22} />
                            : <Circle color={COLORS.textSecondary} size={22} />}
                        </TouchableOpacity>
                        <View style={S.itemInfo}>
                          <Text style={[S.itemName, item.is_completed && S.itemDone]}>{item.name}</Text>
                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
                            {item.quantity && item.quantity > 1 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Package color={COLORS.textSecondary} size={11} />
                                <Text style={S.itemMeta}>Qty: {item.quantity}</Text>
                              </View>
                            )}
                            {item.price && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Tag color={COLORS.textSecondary} size={11} />
                                <Text style={S.itemMeta}>{userCurrency} {parseFloat(item.price).toLocaleString()}</Text>
                              </View>
                            )}
                            {item.description ? <Text style={S.itemMeta}>{item.description}</Text> : null}
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => openItemModal(list.id, item)}>
                          <Edit2 color={COLORS.textSecondary} size={15} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteItem(item.id)} style={{ marginLeft: 10 }}>
                          <Trash2 color={COLORS.error} size={15} />
                        </TouchableOpacity>
                      </View>
                    ))}

                    <TouchableOpacity style={S.addItemBtn} onPress={() => openItemModal(list.id)}>
                      <Plus color={COLORS.primary} size={15} />
                      <Text style={S.addItemText}>Add Item</Text>
                    </TouchableOpacity>
                  </View>
                );
              }) : (
                <View style={S.emptyState}>
                  <ShoppingCart color={COLORS.textSecondary} size={48} style={{ marginBottom: 12 }} />
                  <Text style={S.emptyTitle}>No Lists Yet</Text>
                  <Text style={S.emptyText}>Tap + to create a shopping list</Text>
                </View>
              )
            )}

            {/* Archive */}
            {activeTab === 'archive' && (
              archivedLists.length > 0 ? archivedLists.map(list => (
                <View key={list.id} style={[S.listCard, { opacity: 0.85 }]}>
                  <View style={S.listHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={S.listTitle}>{list.title}</Text>
                      <Text style={S.listMeta}>{list.shopping_items.length} items · Archived</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TouchableOpacity onPress={() => unarchiveList(list.id)}>
                        <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>Restore</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteList(list.id)}>
                        <Trash2 color={COLORS.error} size={18} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {list.shopping_items.map(item => (
                    <View key={item.id} style={S.itemRow}>
                      <CheckCircle2 color={COLORS.success} size={22} />
                      <View style={S.itemInfo}>
                        <Text style={[S.itemName, S.itemDone]}>{item.name}</Text>
                        {item.quantity > 1 && <Text style={S.itemMeta}>Qty: {item.quantity}</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )) : (
                <View style={S.emptyState}>
                  <Archive color={COLORS.textSecondary} size={48} style={{ marginBottom: 12 }} />
                  <Text style={S.emptyTitle}>No Archived Lists</Text>
                  <Text style={S.emptyText}>Completed lists appear here</Text>
                </View>
              )
            )}

            {/* Warranties */}
            {activeTab === 'warranty' && (
              warranties.length > 0 ? warranties.map(war => {
                const isExpired = new Date(war.expiry_date) < new Date();
                const expiringSoon = !isExpired && (new Date(war.expiry_date) - new Date()) < 30 * 24 * 60 * 60 * 1000;
                const warColor = isExpired ? COLORS.error : expiringSoon ? COLORS.warning : COLORS.success;
                return (
                  <View key={war.id} style={[S.warrantyCard, { borderLeftColor: warColor }]}>
                    <View style={S.warHeader}>
                      <Text style={S.warName}>{war.name}</Text>
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
                    <Text style={S.warDate}>Purchased: {new Date(war.purchase_date).toLocaleDateString()}</Text>
                    <Text style={[S.warDate, { color: warColor }]}>
                      {isExpired ? '⚠️ Expired: ' : expiringSoon ? '⚡ Expiring: ' : 'Expires: '}
                      {new Date(war.expiry_date).toLocaleDateString()}
                    </Text>
                  </View>
                );
              }) : (
                <View style={S.emptyState}>
                  <ShieldCheck color={COLORS.textSecondary} size={48} style={{ marginBottom: 12 }} />
                  <Text style={S.emptyTitle}>No Warranties</Text>
                  <Text style={S.emptyText}>Track product warranties here</Text>
                </View>
              )
            )}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setEditingId(null);
          if (activeTab === 'warranty') {
            setWarName('');
            setWarPurchase(new Date());
            setWarExpiry(new Date(new Date().setFullYear(new Date().getFullYear() + 1)));
            setShowWarrantyModal(true);
          } else {
            setListTitle('');
            setShowListModal(true);
          }
        }}
      >
        <Plus color={COLORS.text} size={24} />
      </TouchableOpacity>

      {/* List Modal */}
      <Modal visible={showListModal} animationType="slide" transparent>
        <View style={S.overlay}>
          <View style={S.modalBox}>
            <Text style={S.modalTitle}>{editingId ? 'Edit List' : 'New List'}</Text>
            <TextInput style={S.input} placeholder="List Title" placeholderTextColor={COLORS.textSecondary} value={listTitle} onChangeText={setListTitle} />
            <View style={S.modalActions}>
              <TouchableOpacity onPress={() => setShowListModal(false)}><Text style={S.btnCancel}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveList}><Text style={S.btnSave}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Item Modal */}
      <Modal visible={showItemModal} animationType="slide" transparent>
        <View style={S.overlay}>
          <View style={S.modalBox}>
            <Text style={S.modalTitle}>{editingId ? 'Edit Item' : 'Add Item'}</Text>
            <TextInput style={S.input} placeholder="Item Name *" placeholderTextColor={COLORS.textSecondary} value={itemName} onChangeText={setItemName} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={S.fieldLabel}>Quantity</Text>
                <TextInput
                  style={S.input}
                  placeholder="1"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="number-pad"
                  value={itemQty}
                  onChangeText={setItemQty}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.fieldLabel}>Price ({userCurrency})</Text>
                <TextInput
                  style={S.input}
                  placeholder="Optional"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="decimal-pad"
                  value={itemPrice}
                  onChangeText={setItemPrice}
                />
              </View>
            </View>
            <TextInput style={S.input} placeholder="Note (optional)" placeholderTextColor={COLORS.textSecondary} value={itemDesc} onChangeText={setItemDesc} />
            <View style={S.modalActions}>
              <TouchableOpacity onPress={() => setShowItemModal(false)}><Text style={S.btnCancel}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveItem}><Text style={S.btnSave}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Warranty Modal */}
      <Modal visible={showWarrantyModal} animationType="slide" transparent>
        <View style={S.overlay}>
          <View style={S.modalBox}>
            <Text style={S.modalTitle}>{editingId ? 'Edit Warranty' : 'Add Warranty'}</Text>
            <TextInput style={S.input} placeholder="Item Name *" placeholderTextColor={COLORS.textSecondary} value={warName} onChangeText={setWarName} />
            <TouchableOpacity style={S.dateBtn} onPress={() => { setDatePickerMode('purchase'); setShowDatePicker(true); }}>
              <CalendarDays color={COLORS.primary} size={18} />
              <Text style={{ color: COLORS.text, marginLeft: 8 }}>Purchased: {warPurchase.toLocaleDateString()}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.dateBtn} onPress={() => { setDatePickerMode('expiry'); setShowDatePicker(true); }}>
              <CalendarDays color={COLORS.accent} size={18} />
              <Text style={{ color: COLORS.text, marginLeft: 8 }}>Expires: {warExpiry.toLocaleDateString()}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={datePickerMode === 'purchase' ? warPurchase : warExpiry}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, d) => {
                  setShowDatePicker(false);
                  if (d) { datePickerMode === 'purchase' ? setWarPurchase(d) : setWarExpiry(d); }
                }}
              />
            )}
            <View style={S.modalActions}>
              <TouchableOpacity onPress={() => setShowWarrantyModal(false)}><Text style={S.btnCancel}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveWarranty}><Text style={S.btnSave}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ShoppingList;
