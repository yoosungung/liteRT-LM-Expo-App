import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ChatInput } from '../../../src/components/ChatInput';
import { ChatMessageList } from '../../../src/components/ChatMessageList';
import { useAgentRuntime } from '../../../src/context/AgentContext';
import type { StoredSession } from '../../../src/storage/SessionStore';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runtime = useAgentRuntime();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [input, setInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    if (!id) {
      return;
    }
    const loaded = await runtime.sessionStore.getSession(id);
    setSession(loaded);
    if (loaded) {
      await runtime.ensureConversation(loaded);
    }
  }, [id, runtime]);

  useFocusEffect(
    useCallback(() => {
      void loadSession();
      void runtime.coordinator.onChatFocus(id ?? '');
      return () => {
        void runtime.coordinator.onChatBlur(id ?? '');
      };
    }, [id, loadSession, runtime]),
  );

  const send = async () => {
    if (!id || !input.trim() || busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setStreamingText('');

    try {
      for await (const chunk of runtime.sendUserMessage(id, input)) {
        if (chunk.type === 'token') {
          setStreamingText((prev) => prev + chunk.text);
        } else if (chunk.type === 'error') {
          setError(chunk.message);
        } else if (chunk.type === 'done') {
          setStreamingText('');
          await loadSession();
        }
      }
      setInput('');
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: session.title }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        <ChatMessageList messages={session.messages} streamingText={streamingText} />
        <ChatInput
          value={input}
          onChangeText={setInput}
          onSend={send}
          disabled={busy}
        />
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f8',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    padding: 10,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#991b1b',
  },
});
