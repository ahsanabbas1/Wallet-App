import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { makeStyles } from './styles';
import { Send, Bot, User, Sparkles, Menu, TrendingUp, PieChart, ShoppingCart, Target } from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const VERCEL_PROXY_URL = 'https://wallet-app-ten-sooty.vercel.app/api/chat';
const DAILY_LIMIT = 10;

const AIAssistant = () => {
  const { openDrawer } = useDrawer();
  const { userId } = useAuth();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const scrollViewRef = useRef();

  const [messages, setMessages] = useState([
    {
      id: '1', bubble: 'AI',
      text: "Hi! I'm your AI financial assistant. I have full access to your transactions, budgets, savings goals, shopping lists, and account settings. Ask me anything about your finances!",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [userCurrency, setUserCurrency] = useState('PKR');

  useEffect(() => {
    if (userId) {
      fetchUsage();
      fetchUserCurrency();
    }
  }, [userId]);

  const fetchUserCurrency = async () => {
    const { data } = await supabase.from('users').select('currency').eq('id', userId).single();
    if (data?.currency) setUserCurrency(data.currency);
  };

  const fetchUsage = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('ai_usage').select('request_count')
      .eq('user_id', userId).eq('usage_date', today).single();
    if (data) setUsageCount(data.request_count);
    else if (error?.code === 'PGRST116') setUsageCount(0);
  };

  const updateUsage = async () => {
    const today = new Date().toISOString().split('T')[0];
    const newCount = usageCount + 1;
    await supabase.from('ai_usage').upsert(
      { user_id: userId, usage_date: today, request_count: newCount },
      { onConflict: 'user_id,usage_date' }
    );
    setUsageCount(newCount);
  };

  const getFinancialContext = async () => {
    try {
      const [profileRes, txRes, budgetRes, goalRes, shoppingRes, plannedRes] = await Promise.all([
        supabase.from('users').select('name, currency, notifications_enabled, language').eq('id', userId).single(),
        supabase.from('transactions').select('*, categories(name, color, type)').eq('user_id', userId).order('date', { ascending: false }).limit(100),
        supabase.from('budgets').select('*, categories(name, color)').eq('user_id', userId),
        supabase.from('savings_goals').select('*').eq('user_id', userId),
        supabase.from('shopping_lists').select('*, shopping_items(*)').eq('user_id', userId).eq('is_archived', false),
        supabase.from('planned_payments').select('*').eq('user_id', userId).limit(20),
      ]);

      const profile = profileRes.data;
      const currency = profile?.currency || 'PKR';
      const transactions = txRes.data || [];
      const budgets = budgetRes.data || [];
      const goals = goalRes.data || [];
      const shoppingLists = shoppingRes.data || [];
      const plannedPayments = plannedRes.data || [];

      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const thisMonthTxns = transactions.filter(t => new Date(t.date) >= firstDayThisMonth);
      const lastMonthTxns = transactions.filter(t => {
        const d = new Date(t.date);
        return d >= firstDayLastMonth && d <= lastDayLastMonth;
      });

      const sumExpenses = (txns) => txns.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
      const sumIncome = (txns) => txns.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);

      // Category breakdown this month
      const catBreakdown = {};
      thisMonthTxns.filter(t => t.type === 'expense').forEach(t => {
        const cat = t.categories?.name || 'Uncategorized';
        catBreakdown[cat] = (catBreakdown[cat] || 0) + parseFloat(t.amount);
      });

      // Budget status
      const budgetStatus = budgets.map(b => {
        const spent = thisMonthTxns.filter(t => t.category_id === b.category_id && t.type === 'expense')
          .reduce((s, t) => s + parseFloat(t.amount), 0);
        return {
          category: b.categories?.name || 'Unknown',
          limit: parseFloat(b.total_amount),
          spent,
          percentUsed: b.total_amount > 0 ? ((spent / parseFloat(b.total_amount)) * 100).toFixed(1) : 0
        };
      });

      // Savings goals progress
      const goalsStatus = goals.map(g => ({
        title: g.title,
        target: parseFloat(g.target_amount),
        saved: parseFloat(g.saved_amount || 0),
        percent: g.target_amount > 0 ? ((parseFloat(g.saved_amount || 0) / parseFloat(g.target_amount)) * 100).toFixed(1) : 0,
        targetDate: g.target_date,
        repeatBasis: g.repeat_basis,
      }));

      // Shopping summary
      const shoppingSummary = shoppingLists.map(l => ({
        title: l.title,
        totalItems: l.shopping_items?.length || 0,
        completedItems: l.shopping_items?.filter(i => i.is_completed).length || 0,
      }));

      // All-time totals
      const allExpenses = sumExpenses(transactions);
      const allIncome = sumIncome(transactions);

      // Top spending categories (all time)
      const allCatBreakdown = {};
      transactions.filter(t => t.type === 'expense').forEach(t => {
        const cat = t.categories?.name || 'Uncategorized';
        allCatBreakdown[cat] = (allCatBreakdown[cat] || 0) + parseFloat(t.amount);
      });
      const topCategories = Object.entries(allCatBreakdown)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([name, amount]) => ({ name, amount }));

      const context = {
        userName: profile?.name || 'User',
        currency,
        currentDate: now.toLocaleDateString(),
        currentMonth: now.toLocaleString('default', { month: 'long', year: 'numeric' }),

        thisMonth: {
          expenses: sumExpenses(thisMonthTxns),
          income: sumIncome(thisMonthTxns),
          net: sumIncome(thisMonthTxns) - sumExpenses(thisMonthTxns),
          transactionCount: thisMonthTxns.length,
          categoryBreakdown: catBreakdown,
        },
        lastMonth: {
          expenses: sumExpenses(lastMonthTxns),
          income: sumIncome(lastMonthTxns),
          net: sumIncome(lastMonthTxns) - sumExpenses(lastMonthTxns),
        },
        allTime: {
          totalExpenses: allExpenses,
          totalIncome: allIncome,
          netBalance: allIncome - allExpenses,
          totalTransactions: transactions.length,
          topSpendingCategories: topCategories,
        },
        recentTransactions: transactions.slice(0, 20).map(t => ({
          title: t.title,
          amount: parseFloat(t.amount),
          type: t.type,
          category: t.categories?.name || 'Uncategorized',
          date: t.date,
          description: t.description,
        })),
        budgets: budgetStatus,
        savingsGoals: goalsStatus,
        shoppingLists: shoppingSummary,
        plannedPayments: plannedPayments.slice(0, 10).map(p => ({
          title: p.title || p.name,
          amount: p.amount,
          nextDate: p.next_date || p.due_date,
          frequency: p.frequency,
        })),
      };

      return JSON.stringify(context);
    } catch (e) {
      console.warn('Context fetch failed', e);
      return JSON.stringify({ currency: userCurrency });
    }
  };

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
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const context = await getFinancialContext();

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

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        bubble: 'AI',
        text: result.text || 'Sorry, something went wrong.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hasSparkle: true
      }]);
      await updateUsage();
    } catch (e) {
      Alert.alert('Connection Error', 'Could not reach AI Assistant. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    { label: 'Monthly summary', icon: TrendingUp, prompt: 'Give me a detailed summary of my spending and income this month.' },
    { label: 'Budget status', icon: PieChart, prompt: 'How are my budgets doing? Which categories am I overspending in?' },
    { label: 'Top expenses', icon: TrendingUp, prompt: 'What are my top spending categories and biggest expenses recently?' },
    { label: 'Savings advice', icon: Target, prompt: 'Review my savings goals and give me advice on how to reach them faster.' },
    { label: 'Shopping lists', icon: ShoppingCart, prompt: 'What items do I have on my active shopping lists?' },
  ];

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
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map(msg => <Message key={msg.id} {...msg} />)}
          {loading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 }}>
              <ActivityIndicator color={COLORS.primary} size="small" />
              <Text style={{ color: COLORS.textSecondary, fontSize: 14, fontStyle: 'italic' }}>Analyzing your finances...</Text>
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

const Message = ({ bubble, text, time, hasSparkle }) => {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const isAI = bubble === 'AI';
  return (
    <View style={[styles.messageRow, isAI ? styles.aiRow : styles.userRow]}>
      {isAI && <View style={styles.avatarMini}><Bot color={COLORS.primary} size={16} /></View>}
      <View style={[styles.bubble, isAI ? styles.aiBubble : styles.userBubble]}>
        {hasSparkle && <Sparkles color={COLORS.primary} size={14} style={styles.sparkle} />}
        <Text style={[styles.messageText, isAI ? styles.aiText : styles.userText]}>{text}</Text>
        <Text style={styles.timeText}>{time}</Text>
      </View>
      {!isAI && <View style={[styles.avatarMini, styles.userAvatar]}><User color={COLORS.text} size={16} /></View>}
    </View>
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

