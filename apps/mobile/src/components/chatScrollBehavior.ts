import type { Message } from 'litertlm-native';

export type ChatScrollAction = 'none' | 'scrollToBottom' | 'scrollToStreamingStart';

export interface ChatScrollState {
  messagesLength: number;
  wasStreaming: boolean;
  hasInitialScrolled: boolean;
}

export interface ChatScrollEvent {
  messagesLength: number;
  isStreaming: boolean;
  isInitialLayout?: boolean;
  lastMessageRole?: Message['role'];
}

export function createChatScrollState(
  overrides: Partial<ChatScrollState> = {},
): ChatScrollState {
  return {
    messagesLength: 0,
    wasStreaming: false,
    hasInitialScrolled: false,
    ...overrides,
  };
}

export function decideChatScrollAction(
  prev: ChatScrollState,
  event: ChatScrollEvent,
): { action: ChatScrollAction; next: ChatScrollState } {
  const next: ChatScrollState = {
    ...prev,
    messagesLength: event.messagesLength,
    wasStreaming: event.isStreaming,
  };

  if (event.isInitialLayout && !prev.hasInitialScrolled && event.messagesLength > 0) {
    next.hasInitialScrolled = true;
    return { action: 'scrollToBottom', next };
  }

  if (event.messagesLength !== prev.messagesLength) {
    if (event.lastMessageRole === 'user') {
      return { action: 'scrollToBottom', next };
    }
    return { action: 'none', next };
  }

  if (event.isStreaming && !prev.wasStreaming) {
    next.wasStreaming = true;
    return { action: 'scrollToStreamingStart', next };
  }

  return { action: 'none', next };
}
