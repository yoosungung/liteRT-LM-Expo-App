import { describe, expect, it } from 'vitest';

import { createChatScrollState, decideChatScrollAction } from './chatScrollBehavior';

describe('decideChatScrollAction', () => {
  it('scrolls to bottom on initial layout when messages exist', () => {
    const prev = createChatScrollState();
    const result = decideChatScrollAction(prev, {
      messagesLength: 3,
      isStreaming: false,
      isInitialLayout: true,
      lastMessageRole: 'assistant',
    });
    expect(result.action).toBe('scrollToBottom');
    expect(result.next.hasInitialScrolled).toBe(true);
  });

  it('does not scroll on initial layout when empty', () => {
    const prev = createChatScrollState();
    const result = decideChatScrollAction(prev, {
      messagesLength: 0,
      isStreaming: false,
      isInitialLayout: true,
    });
    expect(result.action).toBe('none');
  });

  it('scrolls to bottom when a user message is appended', () => {
    const prev = createChatScrollState({ messagesLength: 2 });
    const result = decideChatScrollAction(prev, {
      messagesLength: 3,
      isStreaming: false,
      lastMessageRole: 'user',
    });
    expect(result.action).toBe('scrollToBottom');
  });

  it('preserves scroll position when an assistant message is committed', () => {
    const prev = createChatScrollState({ messagesLength: 2, wasStreaming: true });
    const result = decideChatScrollAction(prev, {
      messagesLength: 4,
      isStreaming: false,
      lastMessageRole: 'assistant',
    });
    expect(result.action).toBe('none');
    expect(result.next.wasStreaming).toBe(false);
  });

  it('scrolls to streaming start when streaming begins', () => {
    const prev = createChatScrollState({ messagesLength: 2, wasStreaming: false });
    const result = decideChatScrollAction(prev, {
      messagesLength: 2,
      isStreaming: true,
    });
    expect(result.action).toBe('scrollToStreamingStart');
    expect(result.next.wasStreaming).toBe(true);
  });

  it('does not scroll during streaming token updates', () => {
    const prev = createChatScrollState({ messagesLength: 2, wasStreaming: true });
    const result = decideChatScrollAction(prev, {
      messagesLength: 2,
      isStreaming: true,
    });
    expect(result.action).toBe('none');
  });
});
