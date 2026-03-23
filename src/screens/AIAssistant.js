import React from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../constants/theme';
import { Send, Bot, User, Sparkles, Plus } from 'lucide-react-native';

const AIAssistant = () => {
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
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
            text="You've spent $857.50 on groceries so far. This is 5% more than last month." 
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.padding,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginRight: 6,
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  chatContent: {
    padding: SIZES.padding,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  userAvatar: {
    marginLeft: 8,
    marginRight: 0,
    backgroundColor: COLORS.primary,
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    position: 'relative',
  },
  aiBubble: {
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  sparkle: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  aiText: {
    color: COLORS.text,
  },
  userText: {
    color: COLORS.text,
  },
  timeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  suggestionContainer: {
    backgroundColor: COLORS.background,
    paddingVertical: 12,
  },
  suggestionScroll: {
    paddingHorizontal: SIZES.padding,
    gap: 10,
  },
  chip: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipText: {
    color: COLORS.text,
    fontSize: 13,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.card,
    margin: SIZES.padding,
    borderRadius: 28,
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingHorizontal: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AIAssistant;
