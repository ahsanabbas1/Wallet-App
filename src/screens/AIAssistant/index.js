import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MarkdownRender from '../../components/MarkdownRender';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../context/ThemeContext';
import { makeStyles } from './styles';
import { Send, Bot, User, Sparkles, Menu, TrendingUp, PieChart, ShoppingCart, Target, Info, RefreshCw, Trash2, Copy } from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { fetchUsage, updateUsage, getFinancialContext, saveChatMessage, getChatHistory, clearChatHistory, DAILY_LIMIT } from '../../services/aiService';

const VERCEL_PROXY_URL = 'https://wallet-app-ten-sooty.vercel.app/api/chat';

const formatDateLabel = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

const getMessagesWithSeparators = (msgs) => {
  const result = [];
  let lastDate = null;
  msgs.forEach(msg => {
    const msgDate = msg.createdAt ? msg.createdAt.split('T')[0] : null;
    const effective = msgDate || (lastDate ? null : new Date().toISOString().split('T')[0]);
    if (effective && effective !== lastDate) {
      result.push({ type: 'dateSeparator', date: effective, label: formatDateLabel(effective) });
      lastDate = effective;
    }
    result.push(msg);
  });
  return result;
};

const AIAssistant = () => {
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const { name: profileName, currency: profileCurrency } = useProfile();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const scrollViewRef = useRef();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const userCurrency = profileCurrency || 'PKR';

  useEffect(() => {
    if (userId) {
      Promise.all([
        getChatHistory(userId),
        fetchUsage(userId),
      ]).then(([history, count]) => {
        if (history.length === 0) {
          history = [{
            id: '1', bubble: 'AI',
            text: "Hi! I'm your AI financial assistant. I have full access to your transactions, budgets, savings goals, shopping lists, and account settings. Ask me anything about your finances!",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: new Date().toISOString(),
          }];
        }
        setMessages(history);
        setUsageCount(count);
        setInitialLoading(false);
      });
    }
  }, [userId]);

  const displayedMessages = useMemo(() => getMessagesWithSeparators(messages), [messages]);

  useEffect(() => {
    if (!loading) return;
    const bounce = (dot, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    };
    bounce(dot1, 0);
    bounce(dot2, 200);
    bounce(dot3, 400);
    return () => {
      dot1.setValue(0);
      dot2.setValue(0);
      dot3.setValue(0);
    };
  }, [loading]);

  const handleSend = async (text = inputText) => {
    if (!text.trim() || loading) return;
    if (usageCount >= DAILY_LIMIT) {
      Alert.alert('Limit Reached', `You have used all ${DAILY_LIMIT} daily requests. Come back tomorrow!`);
      return;
    }

    const userMsg = {
      id: Date.now().toString(),
      bubble: 'User',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    if (userId) saveChatMessage(userId, 'user', text);

    try {
      const context = await getFinancialContext(userId, userCurrency, profileName);

      const response = await fetch(VERCEL_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context,
          history: messages.slice(-6).map(m => ({ role: m.bubble === 'AI' ? 'assistant' : 'user', content: m.text }))
        })
      });

      const raw = await response.text();
      let result;
      try { result = JSON.parse(raw); } catch { throw new Error(`Invalid server response (${response.status})`); }
      if (result.error) throw new Error(result.error);

      const aiText = result.text || 'Sorry, something went wrong.';
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        bubble: 'AI',
        text: aiText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hasSparkle: true,
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMsg]);
      if (userId) saveChatMessage(userId, 'assistant', aiText);

      const newCount = await updateUsage(userId);
      setUsageCount(newCount);
    } catch (e) {
      Alert.alert('Connection Error', 'Could not reach AI Assistant. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = useCallback(async (lastUserText) => {
    if (!lastUserText || loading) return;
    if (usageCount >= DAILY_LIMIT) {
      Alert.alert('Limit Reached', `You have used all ${DAILY_LIMIT} daily requests. Come back tomorrow!`);
      return;
    }
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.bubble === 'AI') {
      setMessages(prev => prev.slice(0, -1));
    }
    setLoading(true);

    try {
      const context = await getFinancialContext(userId, userCurrency, profileName);

      const response = await fetch(VERCEL_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: lastUserText,
          context,
          history: messages.slice(-7).filter(m => m.bubble === 'User' || (m.bubble === 'AI' && m.id !== messages[messages.length - 1]?.id)).slice(-6)
            .map(m => ({ role: m.bubble === 'AI' ? 'assistant' : 'user', content: m.text }))
        })
      });

      const raw = await response.text();
      let result;
      try { result = JSON.parse(raw); } catch { throw new Error(`Invalid server response (${response.status})`); }
      if (result.error) throw new Error(result.error);

      const aiText = result.text || 'Sorry, something went wrong.';
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        bubble: 'AI',
        text: aiText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hasSparkle: true,
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMsg]);
      if (userId) saveChatMessage(userId, 'assistant', aiText);

      const newCount = await updateUsage(userId);
      setUsageCount(newCount);
    } catch (e) {
      Alert.alert('Connection Error', 'Could not reach AI Assistant. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, [messages, loading, usageCount, userId, userCurrency, profileName]);

  const handleClear = () => {
    Alert.alert('Clear Conversation', 'Delete all chat messages?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          if (userId) await clearChatHistory(userId);
          setMessages([{
            id: '1', bubble: 'AI',
            text: "Hi! I'm your AI financial assistant. I have full access to your transactions, budgets, savings goals, shopping lists, and account settings. Ask me anything about your finances!",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: new Date().toISOString(),
          }]);
        }
      }
    ]);
  };

  const handleCopy = async (text) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Response copied to clipboard.');
  };

  const showPageInfo = () => Alert.alert('About This Page', 'Ask questions about your finances. The AI analyzes your data and answers in plain language.');

  const suggestions = [
    { label: 'Monthly summary', icon: TrendingUp, prompt: 'Give me a detailed summary of my spending and income this month.' },
    { label: 'Budget status', icon: PieChart, prompt: 'How are my budgets doing? Which categories am I overspending in?' },
    { label: 'Top expenses', icon: TrendingUp, prompt: 'What are my top spending categories and biggest expenses recently?' },
    { label: 'Savings advice', icon: Target, prompt: 'Review my savings goals and give me advice on how to reach them faster.' },
    { label: 'Shopping lists', icon: ShoppingCart, prompt: 'What items do I have on my active shopping lists?' },
  ];

  if (initialLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

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
              <Text style={styles.statusText}>{usageCount}/{DAILY_LIMIT} Requests · {userCurrency}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleClear} style={{ padding: 8 }}>
            <Trash2 color={COLORS.textSecondary} size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={showPageInfo} style={{ padding: 8 }}>
            <Info color={COLORS.textSecondary} size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {displayedMessages.map((item, index) => {
            if (item.type === 'dateSeparator') {
              return (
                <View key={item.date} style={styles.dateSeparator}>
                  <Text style={styles.dateSeparatorText}>{item.label}</Text>
                </View>
              );
            }
            const isAI = item.bubble === 'AI';
            const prevMsg = displayedMessages[index - 1];
            const showAvatar = prevMsg?.type === 'dateSeparator' || prevMsg?.bubble !== item.bubble;
            return (
              <View key={item.id}>
                <View style={[styles.messageRow, isAI ? styles.aiRow : styles.userRow]}>
                  {isAI && showAvatar && <View style={styles.avatarMini}><Bot color={COLORS.primary} size={16} /></View>}
                  {isAI && !showAvatar && <View style={{ width: 40 }} />}
                  <TouchableOpacity
                    onLongPress={() => handleCopy(item.text)}
                    delayLongPress={600}
                    activeOpacity={0.8}
                    style={[styles.bubble, isAI ? styles.aiBubble : styles.userBubble, { maxWidth: '80%' }]}
                  >
                    {item.hasSparkle && <Sparkles color={COLORS.primary} size={14} style={styles.sparkle} />}
                    {isAI ? (
                      <MarkdownRender>{item.text}</MarkdownRender>
                    ) : (
                      <Text style={[styles.messageText, styles.userText]}>{item.text}</Text>
                    )}
                    <Text style={styles.timeText}>{item.time}</Text>
                  </TouchableOpacity>
                  {!isAI && showAvatar && <View style={[styles.avatarMini, styles.userAvatar]}><User color={COLORS.text} size={16} /></View>}
                  {!isAI && !showAvatar && <View style={{ width: 40 }} />}
                </View>
                {isAI && (
                  <View style={styles.aiActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleCopy(item.text)}>
                      <Copy color={COLORS.textSecondary} size={12} />
                      <Text style={styles.actionText}>Copy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleRegenerate(
                      [...messages].reverse().find(m => m.bubble === 'User')?.text
                    )}>
                      <RefreshCw color={COLORS.textSecondary} size={12} />
                      <Text style={styles.actionText}>Regenerate</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {loading && (
            <View style={styles.typingContainer}>
              {[dot1, dot2, dot3].map((dot, i) => (
                <Animated.View
                  key={i}
                  style={[styles.typingDot, {
                    opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                    transform: [{
                      translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] })
                    }]
                  }]}
                />
              ))}
              <Text style={styles.typingText}>Analyzing your finances...</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.suggestionContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionScroll}>
            {suggestions.map(s => (
              <SuggestionChip key={s.label} label={s.label} icon={s.icon} onPress={() => handleSend(s.prompt)} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={usageCount >= DAILY_LIMIT ? 'Daily limit reached...' : 'Ask about your finances...'}
            placeholderTextColor={COLORS.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            editable={!loading && usageCount < DAILY_LIMIT}
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity
            style={[styles.sendButton, (loading || usageCount >= DAILY_LIMIT) && { opacity: 0.4 }]}
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

const SuggestionChip = ({ label, icon: Icon, onPress }) => {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <TouchableOpacity style={styles.chip} onPress={onPress}>
      {Icon && <Icon color={COLORS.primary} size={12} style={{ marginRight: 4 }} />}
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
};

export default AIAssistant;
