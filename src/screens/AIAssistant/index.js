import React from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { Send, Bot, User, Sparkles, Plus, Menu } from 'lucide-react-native';
import { useDrawer } from '../../context/DrawerContext';
import { styles } from './styles';

const AIAssistant = () => {
  const { openDrawer } = useDrawer();
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={{ marginRight: 16 }}
            onPress={openDrawer}
          >
            <Menu color={COLORS.text} size={24} />
          </TouchableOpacity>
          <Bot color={COLORS.primary} size={28} />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <View style={styles.statusContainer}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.chatContent}>
          <Message bubble="AI" text="Hi Alex! I'm your AI financial assistant. How can I help you today?" time="10:00 AM" />
          <Message bubble="User" text="How much did I spend on groceries this month?" time="10:01 AM" />
          <Message 
            bubble="AI" 
            text="You've spent PKR 857.50 on groceries so far. This is 5% more than last month." 
            time="10:01 AM" 
            hasSparkle 
          />
        </ScrollView>

        {/* Suggestions */}
        <View style={styles.suggestionContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionScroll}>
            <SuggestionChip label="Show breakdown" />
            <SuggestionChip label="Set a limit" />
            <SuggestionChip label="Compare to last month" />
            <SuggestionChip label="Export CSV" />
          </ScrollView>
        </View>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.attachButton}>
            <Plus color={COLORS.textSecondary} size={24} />
          </TouchableOpacity>
          <TextInput 
            style={styles.input} 
            placeholder="Ask me anything..." 
            placeholderTextColor={COLORS.textSecondary}
          />
          <TouchableOpacity style={styles.sendButton}>
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

const SuggestionChip = ({ label }) => (
  <TouchableOpacity style={styles.chip}>
    <Text style={styles.chipText}>{label}</Text>
  </TouchableOpacity>
);

export default AIAssistant;
