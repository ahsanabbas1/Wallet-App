import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import styles from './styles';

const AddTransaction = ({ navigation, route }) => {
  const editTransaction = route.params?.transaction;
  const isEdit = !!editTransaction;

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [type, setType] = useState(editTransaction?.type || 'expense');
  const [amount, setAmount] = useState(editTransaction?.amount?.toString() || '');
  const [title, setTitle] = useState(editTransaction?.title || '');
  const [description, setDescription] = useState(editTransaction?.description || '');

  useEffect(() => {
    navigation.setOptions({
      title: isEdit ? 'Edit Record' : 'Add Record'
    });
    fetchCategories();
  }, [isEdit]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setCategories(data);
        if (isEdit) {
          const found = data.find(c => c.id === editTransaction.category_id);
          setSelectedCategory(found || data[0]);
        } else {
          setSelectedCategory(data[0]);
        }
      } else {
        // Fallback dummy categories
        const fallback = [
          { id: '1', name: 'Dining Out', color: '#FF5722' },
          { id: '2', name: 'Grocery', color: '#FF9800' },
          { id: '3', name: 'Transport', color: '#03A9F4' },
        ];
        setCategories(fallback);
        setSelectedCategory(fallback[0]);
      }
    } catch (error) {
      console.warn('Error fetching categories:', error.message);
      const fallback = [
        { id: '1', name: 'Dining Out', color: '#FF5722' },
        { id: '2', name: 'Grocery', color: '#FF9800' },
        { id: '3', name: 'Transport', color: '#03A9F4' },
      ];
      setCategories(fallback);
      setSelectedCategory(fallback[0]);
    }
  };

  const handleSave = async () => {
    if (!title || !amount || !selectedCategory) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const userId = '00000000-0000-0000-0000-000000000001';

      const transactionData = {
        user_id: userId,
        category_id: selectedCategory.id,
        amount: parseFloat(amount),
        type: type,
        title: title,
        description: description,
        date: isEdit ? editTransaction.date : new Date().toISOString(),
      };

      let result;
      if (isEdit) {
        result = await supabase
          .from('transactions')
          .update(transactionData)
          .eq('id', editTransaction.id);
      } else {
        result = await supabase
          .from('transactions')
          .insert(transactionData);
      }

      if (result.error) throw result.error;

      Alert.alert('Success', `Transaction ${isEdit ? 'updated' : 'added'} successfully!`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Type Selector */}
        <View style={styles.typeContainer}>
          <TouchableOpacity 
            style={[styles.typeButton, type === 'expense' && styles.typeButtonActive]} 
            onPress={() => setType('expense')}
          >
            <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.typeButton, type === 'income' && styles.typeButtonActive]} 
            onPress={() => setType('income')}
          >
            <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>Income</Text>
          </TouchableOpacity>
        </View>

        {/* Amount Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>PKR </Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </View>

        {/* Title Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Grocery Shop"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Category Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryList}>
            {categories.map((cat) => (
              <TouchableOpacity 
                key={cat.id}
                style={[
                  styles.categoryChip, 
                  selectedCategory?.id === cat.id && { backgroundColor: cat.color + '40', borderColor: cat.color }
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[
                  styles.categoryChipText,
                  selectedCategory?.id === cat.id && { color: cat.color, fontWeight: 'bold' }
                ]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Note (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add a note..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{isEdit ? 'Update Record' : 'Save Transaction'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddTransaction;
