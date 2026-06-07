import { useCallback, useEffect, useRef } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import type { Message, ToolCall } from 'litertlm-native';

import {
  createChatScrollState,
  decideChatScrollAction,
  type ChatScrollState,
} from './chatScrollBehavior';
import { CollapsibleMessageBody } from './CollapsibleMessageBody';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallBlock } from './ToolCallBlock';

interface ChatMessageListProps {
  messages: Message[];
  streamingText?: string;
  streamingThinking?: string;
  streamingToolCalls?: ToolCall[];
}

export function ChatMessageList({
  messages,
  streamingText,
  streamingThinking,
  streamingToolCalls,
}: ChatMessageListProps) {
  const listRef = useRef<FlatList<Message>>(null);
  const scrollStateRef = useRef<ChatScrollState>(createChatScrollState());

  const isStreaming = Boolean(streamingText || streamingThinking);

  const data = isStreaming
    ? [
        ...messages,
        {
          id: 'streaming',
          role: 'assistant' as const,
          content: streamingText ?? '',
          thinking: streamingThinking,
          toolCalls: streamingToolCalls,
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

  const scrollToStreamingStart = useCallback(() => {
    const index = data.length - 1;
    if (index < 0) {
      return;
    }
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, viewPosition: 0, animated: false });
    });
  }, [data.length]);

  const applyScrollAction = useCallback(
    (action: ReturnType<typeof decideChatScrollAction>['action']) => {
      if (action === 'scrollToBottom') {
        scrollToBottom(false);
      } else if (action === 'scrollToStreamingStart') {
        scrollToStreamingStart();
      }
    },
    [scrollToBottom, scrollToStreamingStart],
  );

  const syncScroll = useCallback(
    (options?: { isInitialLayout?: boolean }) => {
      const lastMessage = messages.at(-1);
      const { action, next } = decideChatScrollAction(scrollStateRef.current, {
        messagesLength: messages.length,
        isStreaming,
        isInitialLayout: options?.isInitialLayout,
        lastMessageRole: lastMessage?.role,
      });
      scrollStateRef.current = next;
      applyScrollAction(action);
    },
    [applyScrollAction, isStreaming, messages],
  );

  useEffect(() => {
    syncScroll();
  }, [messages.length, isStreaming, syncScroll]);

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number }) => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0, animated: false });
      });
    },
    [],
  );

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
          {item.role === 'assistant' && item.toolCalls?.length ? (
            <ToolCallBlock
              toolCalls={item.toolCalls}
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
          <CollapsibleMessageBody
            content={item.content}
            textStyle={item.role === 'user' ? styles.userText : styles.assistantText}
            isStreaming={item.id === 'streaming'}
          />
        </View>
      )}
      onLayout={() => syncScroll({ isInitialLayout: true })}
      onScrollToIndexFailed={handleScrollToIndexFailed}
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
