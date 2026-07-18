import { StyleSheet } from 'react-native';
import { SIZES } from '../../constants/theme';

export const makeStyles = (COLORS) => StyleSheet.create({
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
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  aiActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginLeft: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 6,
    marginLeft: 40,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  typingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    marginLeft: 6,
  },
  markdownStyle: {
    body: { color: COLORS.text, fontSize: 15, lineHeight: 20 },
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
    link: { color: COLORS.primary },
    heading1: { color: COLORS.text, fontSize: 20, fontWeight: 'bold', marginVertical: 8 },
    heading2: { color: COLORS.text, fontSize: 17, fontWeight: 'bold', marginVertical: 6 },
    heading3: { color: COLORS.text, fontSize: 15, fontWeight: 'bold', marginVertical: 4 },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginVertical: 2 },
    code_inline: { backgroundColor: 'rgba(255,255,255,0.08)', color: COLORS.primary, paddingHorizontal: 4, borderRadius: 4 },
    fence: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 8, marginVertical: 4 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: COLORS.primary, paddingLeft: 8, marginVertical: 4, opacity: 0.8 },
    table: { marginVertical: 8 },
    thead: { backgroundColor: 'rgba(255,255,255,0.05)' },
    tr: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  },
});
