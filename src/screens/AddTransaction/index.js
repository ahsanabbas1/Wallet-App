import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import styles from './styles';
import { COLORS } from '../../constants/theme';

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
        const filtered = data.filter(c => c.type === type || c.type === 'both');
        if (isEdit) {
          const found = data.find(c => c.id === editTransaction.category_id);
          setSelectedCategory(found || filtered[0]);
        } else {
          setSelectedCategory(filtered[0]);
        }
      } else {
        Alert.alert('No Categories', 'No categories found. Please contact support.');
      }
    } catch (error) {
      console.warn('Error fetching categories:', error.message);
      Alert.alert('Error', 'Could not load categories. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!title || !amount || !selectedCategory) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert('Error', 'You must be logged in to save a transaction.');
        setLoading(false);
        return;
      }
      const userId = session.user.id;

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

      // Alert.alert('Success', `Transaction ${isEdit ? 'updated' : 'added'} successfully!`);
      setTimeout(() => {
        navigation.goBack();
      }, 100);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    const filtered = categories.filter(c => c.type === newType || c.type === 'both');
    if (filtered.length > 0) {
      if (!filtered.find(c => c.id === selectedCategory?.id)) {
        setSelectedCategory(filtered[0]);
      }
    } else {
      setSelectedCategory(null);
    }
  };

  const filteredCategories = categories.filter(c => c.type === type || c.type === 'both');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Type Selector */}
        <View style={styles.typeContainer}>
          <TouchableOpacity 
            style={[styles.typeButton, type === 'expense' && styles.typeButtonActive]} 
            onPress={() => handleTypeChange('expense')}
          >
            <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.typeButton, type === 'income' && styles.typeButtonActive]} 
            onPress={() => handleTypeChange('income')}
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
            {filteredCategories.map((cat) => (
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.label}>Note (Optional)</Text>
            <Text style={{ color: description.length >= 240 ? COLORS.error : COLORS.textSecondary, fontSize: 10 }}>
              {description.length}/250
            </Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add a note..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={(text) => text.length <= 250 && setDescription(text)}
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
