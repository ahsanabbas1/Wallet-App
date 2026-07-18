import React from 'react';
import { View, Text, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const parseInline = (text, colors) => {
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(<Text key={key++} style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: colors.primary, paddingHorizontal: 4, borderRadius: 4, fontSize: 14 }}>{codeMatch[1]}</Text>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      parts.push(<Text key={key++} style={{ fontWeight: '700' }}>{boldMatch[1]}</Text>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      parts.push(<Text key={key++} style={{ fontStyle: 'italic' }}>{italicMatch[1]}</Text>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(<Text key={key++} style={{ color: colors.primary, textDecorationLine: 'underline' }}>{linkMatch[1]}</Text>);
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    const newlineMatch = remaining.match(/^\\n/);
    if (newlineMatch) {
      parts.push(<Text key={key++}>{'\n'}</Text>);
      remaining = remaining.slice(newlineMatch[0].length);
      continue;
    }

    const char = remaining[0];
    parts.push(<Text key={key++}>{char}</Text>);
    remaining = remaining.slice(1);
  }
  return parts;
};

const MarkdownRender = ({ children, style }) => {
  const { colors } = useTheme();
  if (!children) return null;

  const text = typeof children === 'string' ? children : '';
  const lines = text.split('\n');
  const elements = [];
  let key = 0;
  let inList = false;
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <View key={key++} style={{ marginVertical: 4 }}>
          {listItems.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', marginVertical: 2 }}>
              <Text style={{ color: colors.textSecondary, width: 20 }}>{item.ordered ? `${item.num}.` : '\u2022'}</Text>
              <View style={{ flex: 1 }}>{item.content}</View>
            </View>
          ))}
        </View>
      );
      listItems = [];
    }
    inList = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      elements.push(<View key={key++} style={{ height: 8 }} />);
      continue;
    }

    const h1Match = trimmed.match(/^# (.+)/);
    if (h1Match) {
      flushList();
      elements.push(
        <Text key={key++} style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginVertical: 8 }}>{parseInline(h1Match[1], colors)}</Text>
      );
      continue;
    }

    const h2Match = trimmed.match(/^## (.+)/);
    if (h2Match) {
      flushList();
      elements.push(
        <Text key={key++} style={{ color: colors.text, fontSize: 17, fontWeight: 'bold', marginVertical: 6 }}>{parseInline(h2Match[1], colors)}</Text>
      );
      continue;
    }

    const h3Match = trimmed.match(/^### (.+)/);
    if (h3Match) {
      flushList();
      elements.push(
        <Text key={key++} style={{ color: colors.text, fontSize: 15, fontWeight: 'bold', marginVertical: 4 }}>{parseInline(h3Match[1], colors)}</Text>
      );
      continue;
    }

    const blockquoteMatch = trimmed.match(/^> (.+)/);
    if (blockquoteMatch) {
      flushList();
      elements.push(
        <View key={key++} style={{ borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 8, marginVertical: 4, opacity: 0.8 }}>
          <Text style={{ color: colors.text, fontSize: 14 }}>{parseInline(blockquoteMatch[1], colors)}</Text>
        </View>
      );
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)\. (.+)/);
    if (orderedMatch) {
      inList = true;
      listItems.push({ ordered: true, num: orderedMatch[1], content: <Text style={{ color: colors.text, fontSize: 14 }}>{parseInline(orderedMatch[2], colors)}</Text> });
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*] (.+)/);
    if (unorderedMatch) {
      inList = true;
      listItems.push({ ordered: false, content: <Text style={{ color: colors.text, fontSize: 14 }}>{parseInline(unorderedMatch[1], colors)}</Text> });
      continue;
    }

    const codeBlockMatch = trimmed.match(/^```/);
    if (codeBlockMatch) {
      flushList();
      let codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (codeLines.length > 0) {
        elements.push(
          <View key={key++} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 8, marginVertical: 4 }}>
            <Text style={{ color: colors.primary, fontSize: 13, fontFamily: Platform?.OS === 'ios' ? 'Menlo' : 'monospace' }}>{codeLines.join('\n')}</Text>
          </View>
        );
      }
      continue;
    }

    flushList();
    const horizontalRule = trimmed.match(/^---+/);
    if (horizontalRule) {
      elements.push(<View key={key++} style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 }} />);
      continue;
    }

    const tableMatch = trimmed.includes('|');
    if (tableMatch && trimmed.startsWith('|')) {
      let tableRows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].split('|').filter(c => c.trim()).map(c => c.trim());
        if (!cells.every(c => /^[-:]+$/.test(c))) {
          tableRows.push(cells);
        }
        i++;
      }
      i--;
      if (tableRows.length > 0) {
        elements.push(
          <View key={key++} style={{ marginVertical: 8 }}>
            {tableRows.map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row', borderBottomWidth: ri === 0 ? 2 : 1, borderBottomColor: 'rgba(255,255,255,0.1)', backgroundColor: ri === 0 ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                {row.map((cell, ci) => (
                  <Text key={ci} style={{ flex: 1, color: colors.text, fontSize: 13, padding: 4, fontWeight: ri === 0 ? '700' : '400' }}>{parseInline(cell, colors)}</Text>
                ))}
              </View>
            ))}
          </View>
        );
      }
      continue;
    }

    elements.push(
      <Text key={key++} style={{ color: colors.text, fontSize: 15, lineHeight: 22, marginVertical: 2 }}>{parseInline(trimmed, colors)}</Text>
    );
  }

  flushList();

  return <View style={style}>{elements}</View>;
};

export default MarkdownRender;
