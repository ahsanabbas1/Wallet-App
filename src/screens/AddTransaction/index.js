import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback, 
  Keyboard,
  ActivityIndicator,
  Pressable
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import styles from './styles';
import { COLORS } from '../../constants/theme';

// Modular Components
import AppButton from '../../components/Common/AppButton';
import AppInput from '../../components/Common/AppInput';

// Services
import { transactionService } from '../../services/transactionService';

const AddTransaction = ({ navigation, route }) => {
  const editTransaction = route.params?.transaction;
  const isEdit = !!editTransaction;

  const [loading, setLoading] = useState(false);
  const [fetchingCategories, setFetchingCategories] = useState(true);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Form State
  const [form, setForm] = useState({
    type: editTransaction?.type || 'expense',
    amount: editTransaction?.amount?.toString() || '',
    title: editTransaction?.title || '',
    description: editTransaction?.description || ''
  });

  useEffect(() => {
    navigation.setOptions({
      title: isEdit ? 'Edit Record' : 'Add Record'
    });
    fetchCategories();
  }, [isEdit]);

  const fetchCategories = async () => {
    try {
      setFetchingCategories(true);
      const data = await transactionService.getCategories();
      
      if (data && data.length > 0) {
        setCategories(data);
        const filtered = data.filter(c => c.type === form.type || c.type === 'both');
        if (isEdit) {
          const found = data.find(c => c.id === editTransaction.category_id);
          setSelectedCategory(found || filtered[0]);
        } else {
          setSelectedCategory(filtered[0]);
        }
      } else {
        Alert.alert('No Categories', 'No categories found.');
      }
    } catch (error) {
      console.warn('Error fetching categories:', error.message);
      Alert.alert('Error', 'Could not load categories.');
    } finally {
      setFetchingCategories(false);
    }
  };

  const handleSave = async () => {
    const { title, amount, type, description } = form;

    if (!title || !amount || !selectedCategory) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert('Error', 'You must be logged in.');
        return;
      }

      const transactionData = {
        user_id: session.user.id,
        category_id: selectedCategory.id,
        amount: parseFloat(amount),
        type: type,
        title: title,
        description: description,
        date: isEdit ? editTransaction.date : new Date().toISOString(),
      };

      if (isEdit) {
        await transactionService.updateTransaction(editTransaction.id, transactionData);
      } else {
        await transactionService.addTransaction(transactionData);
      }

      setTimeout(() => {
        navigation.goBack();
      }, 100);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateFormField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleTypeChange = (newType) => {
    updateFormField('type', newType);
    const filtered = categories.filter(c => c.type === newType || c.type === 'both');
    if (filtered.length > 0) {
      if (!filtered.find(c => c.id === selectedCategory?.id)) {
        setSelectedCategory(filtered[0]);
      }
    } else {
      setSelectedCategory(null);
    }
  };

  const filteredCategories = categories.filter(c => c.type === form.type || c.type === 'both');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Type Selector */}
            <View style={styles.typeContainer}>
              <AppButton 
                title="Expense"
                variant={form.type === 'expense' ? 'primary' : 'secondary'}
                onPress={() => handleTypeChange('expense')}
                style={{ flex: 1, borderRadius: 12 }}
              />
              <AppButton 
                title="Income"
                variant={form.type === 'income' ? 'primary' : 'secondary'}
                onPress={() => handleTypeChange('income')}
                style={{ flex: 1, borderRadius: 12, marginLeft: 10 }}
              />

            </View>

            {/* Amount Input */}
            <AppInput 
              label="Amount"
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={form.amount}
              onChangeText={(val) => updateFormField('amount', val)}
            />

            {/* Title Input */}
            <AppInput 
              label="Title"
              placeholder="e.g. Grocery Shop"
              value={form.title}
              onChangeText={(val) => updateFormField('title', val)}
            />

            {/* Category Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              {fetchingCategories ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <View style={{ gap: 20 }}>
                  {(() => {
                    const parents = filteredCategories.filter(c => !c.parent_id);
                    const children = filteredCategories.filter(c => c.parent_id);
                    
                    return parents.map(parent => {
                      const subs = children.filter(child => child.parent_id === parent.id);
                      if (subs.length === 0) return null;

                      return (
                        <View key={parent.id} style={styles.categoryGroup}>
                          <View style={styles.groupHeader}>
                            <Text style={[styles.groupHeaderText, { color: parent.color }]}>
                              {parent.name}
                            </Text>
                            <View style={[styles.groupLine, { backgroundColor: parent.color + '30' }]} />
                          </View>
                          <View style={styles.categoryList}>
                            {subs.map((cat) => (
                              <Pressable 
                                key={cat.id}
                                style={[
                                  styles.categoryChip, 
                                  selectedCategory?.id === cat.id && { backgroundColor: parent.color + '40', borderColor: parent.color }
                                ]}
                                onPress={() => setSelectedCategory(cat)}
                              >
                                <Text style={[
                                  styles.categoryChipText,
                                  selectedCategory?.id === cat.id && { color: parent.color, fontWeight: 'bold' }
                                ]}>
                                  {cat.name}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      );
                    });
                  })()}
                </View>
              )}
            </View>


            {/* Description Input */}
            <AppInput 
              label={`Note (Optional) ${form.description.length}/250`}
              placeholder="Add a note..."
              multiline
              numberOfLines={3}
              value={form.description}
              onChangeText={(text) => text.length <= 250 && updateFormField('description', text)}
              style={styles.textArea}
            />

            {/* Save Button */}
            <AppButton 
              title={isEdit ? 'Update Record' : 'Save Transaction'}
              onPress={handleSave}
              loading={loading}
              style={{ marginTop: 20 }}
            />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AddTransaction;

