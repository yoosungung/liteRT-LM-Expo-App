import { useCallback, useEffect, useRef } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import type { Message } from 'litertlm-native';

import { ThinkingBlock } from './ThinkingBlock';

interface ChatMessageListProps {
  messages: Message[];
  streamingText?: string;
  streamingThinking?: string;
}

export function ChatMessageList({
  messages,
  streamingText,
  streamingThinking,
}: ChatMessageListProps) {
  const listRef = useRef<FlatList<Message>>(null);

  const data = streamingText || streamingThinking
    ? [
        ...messages,
        {
          id: 'streaming',
          role: 'assistant' as const,
          content: streamingText ?? '',
          thinking: streamingThinking,
          timestamp: Date.now(),
        },
      ]
    : messages;

  const scrollToBottom = useCallback((animated: boolean) => {
    if (data.length === 0) {
      return;
    }
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, [data.length]);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length, streamingText, streamingThinking, scrollToBottom]);

  return (
    <FlatList
      ref={listRef}
      style={styles.listContainer}
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <View
          style={[
            styles.bubble,
            item.role === 'user' ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          {item.role === 'assistant' && item.thinking ? (
            <ThinkingBlock
              thinking={item.thinking}
              defaultExpanded={item.id === 'streaming'}
            />
          ) : null}
          {item.attachments?.map((attachment, index) =>
            attachment.type === 'image' ? (
              <Image
                key={`${item.id}-attachment-${index}`}
                source={{ uri: attachment.uri }}
                style={styles.imageAttachment}
                accessibilityLabel="User attached image"
              />
            ) : null,
          )}
          <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>
            {item.content}
            {item.id === 'streaming' && item.content ? '▍' : ''}
          </Text>
        </View>
      )}
      onContentSizeChange={() => scrollToBottom(false)}
      onLayout={() => scrollToBottom(false)}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    />
  );
}

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
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
  imageAttachment: {
    width: 180,
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#eee',
  },
});
