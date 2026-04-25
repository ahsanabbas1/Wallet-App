import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { Send, Bot, User, Sparkles, Plus, Menu } from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { styles } from './styles';

// --- CONFIGURATION ---
const VERCEL_PROXY_URL = 'https://wallet-app-ten-sooty.vercel.app/api/chat'; // USER: Update this after deploying your Vercel function
const DAILY_LIMIT = 10;

const AIAssistant = () => {
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const scrollViewRef = useRef();

  const [messages, setMessages] = useState([
    { id: '1', bubble: 'AI', text: "Hi! I'm your AI financial assistant. I can help you track spending, set budgets, and analyze your transactions. How can I help today?", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [usageCount, setUsageCount] = useState(0);

  useEffect(() => {
    if (userId) fetchUsage();
  }, [userId]);

  const fetchUsage = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('ai_usage')
      .select('request_count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single();

    if (data) setUsageCount(data.request_count);
    else if (error && error.code === 'PGRST116') setUsageCount(0); // No record found
  };

  const updateUsage = async () => {
    const today = new Date().toISOString().split('T')[0];
    const newCount = usageCount + 1;

    await supabase.from('ai_usage').upsert({
      user_id: userId,
      usage_date: today,
      request_count: newCount
    }, { onConflict: 'user_id,usage_date' });

    setUsageCount(newCount);
  };

  const getFinancialContext = async () => {
    try {
      // Fetch balance and last 5 transactions for context
      const { data: transactions } = await supabase
        .from('transactions')
        .select('title, amount, type, date')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(10);

      const { data: profile } = await supabase
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();

      const context = {
        userName: profile?.name || 'User',
        recentTransactions: transactions || [],
        date: new Date().toLocaleDateString()
      };

      return JSON.stringify(context);
    } catch (e) {
      console.warn('Context fetch failed', e);
      return '{}';
    }
  };

  const handleSend = async (text = inputText) => {
    if (!text.trim() || loading) return;

    if (usageCount >= DAILY_LIMIT) {
      Alert.alert('Limit Reached', `You have used your ${DAILY_LIMIT} daily AI requests. Please come back tomorrow!`);
      return;
    }

    const userMessage = {
      id: Date.now().toString(),
      bubble: 'User',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const context = await getFinancialContext();

      const response = await fetch(VERCEL_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: context,
          history: messages.slice(-5).map(m => ({ role: m.bubble === 'AI' ? 'assistant' : 'user', content: m.text }))
        })
      });

      const responseText = await response.text();
      let result;

      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse AI response:', responseText);
        throw new Error(`Invalid response from server (Status: ${response.status})`);
      }

      if (result.error) throw new Error(result.error);

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        bubble: 'AI',
        text: result.text || 'Sorry, I encountered an error.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hasSparkle: true
      };

      setMessages(prev => [...prev, aiMessage]);
      await updateUsage();
    } catch (e) {
      Alert.alert('Error', 'Could not reach AI Assistant. Check your proxy URL or connection.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity style={{ marginRight: 16 }} onPress={openDrawer}>
            <Menu color={COLORS.text} size={24} />
          </TouchableOpacity>
          <Bot color={COLORS.primary} size={28} />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: usageCount >= DAILY_LIMIT ? COLORS.error : '#4CAF50' }]} />
              <Text style={styles.statusText}>{usageCount}/{DAILY_LIMIT} Requests Today</Text>
            </View>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map(msg => (
            <Message key={msg.id} {...msg} />
          ))}
          {loading && (
            <View style={localStyles.loadingRow}>
              <ActivityIndicator color={COLORS.primary} size="small" />
              <Text style={localStyles.loadingText}>Llama is thinking...</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.suggestionContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionScroll}>
            <SuggestionChip label="Monthly spending summary" onPress={() => handleSend("Give me a summary of my spending this month.")} />
            <SuggestionChip label="Biggest expense?" onPress={() => handleSend("What was my biggest expense recently?")} />
            <SuggestionChip label="Budget status" onPress={() => handleSend("How am I doing on my budgets?")} />
          </ScrollView>
        </View>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={usageCount >= DAILY_LIMIT ? "Limit reached..." : "Ask me anything..."}
            placeholderTextColor={COLORS.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            editable={!loading && usageCount < DAILY_LIMIT}
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity
            style={[styles.sendButton, (loading || usageCount >= DAILY_LIMIT) && { opacity: 0.5 }]}
            onPress={() => handleSend()}
            disabled={loading || usageCount >= DAILY_LIMIT}
          >
            <Send color={COLORS.text} size={20} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Message = ({ bubble, text, time, hasSparkle }) => {
  const isAI = bubble === 'AI';
  return (
    <View style={[styles.messageRow, isAI ? styles.aiRow : styles.userRow]}>
      {isAI && (
        <View style={styles.avatarMini}>
          <Bot color={COLORS.primary} size={16} />
        </View>
      )}
      <View style={[styles.bubble, isAI ? styles.aiBubble : styles.userBubble]}>
        {hasSparkle && <Sparkles color={COLORS.primary} size={14} style={styles.sparkle} />}
        <Text style={[styles.messageText, isAI ? styles.aiText : styles.userText]}>{text}</Text>
        <Text style={styles.timeText}>{time}</Text>
      </View>
      {!isAI && (
        <View style={[styles.avatarMini, styles.userAvatar]}>
          <User color={COLORS.text} size={16} />
        </View>
      )}
    </View>
  );
};

const SuggestionChip = ({ label, onPress }) => (
  <TouchableOpacity style={styles.chip} onPress={onPress}>
    <Text style={styles.chipText}>{label}</Text>
  </TouchableOpacity>
);

const localStyles = {
  loadingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
  loadingText: { color: COLORS.textSecondary, fontSize: 14, fontStyle: 'italic' }
};

export default AIAssistant;
