import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { Message } from 'litertlm-native';

interface ChatMessageListProps {
  messages: Message[];
  streamingText?: string;
}

export function ChatMessageList({ messages, streamingText }: ChatMessageListProps) {
  const data = streamingText
    ? [
        ...messages,
        {
          id: 'streaming',
          role: 'assistant' as const,
          content: streamingText,
          timestamp: Date.now(),
        },
      ]
    : messages;

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View
          style={[
            styles.bubble,
            item.role === 'user' ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>
            {item.content}
            {item.id === 'streaming' ? '▍' : ''}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#111',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  userText: {
    color: '#fff',
    lineHeight: 22,
  },
  assistantText: {
    color: '#111',
    lineHeight: 22,
  },
});
