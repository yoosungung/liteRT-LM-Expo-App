import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';

import type { ToolCall, ToolRiskLevel } from 'litertlm-native';

import { ChatInput } from '../../../src/components/ChatInput';
import { ChatMessageList } from '../../../src/components/ChatMessageList';
import { ToolApprovalSheet } from '../../../src/components/ToolApprovalSheet';
import { useAgentRuntime } from '../../../src/context/AgentContext';
import type { StoredSession } from '../../../src/storage/SessionStore';

interface PendingApproval {
  toolCall: ToolCall;
  riskLevel: ToolRiskLevel;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runtime = useAgentRuntime();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [input, setInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const approvalResolvers = useRef(new Map<string, () => void>());
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSession = useCallback(async () => {
    if (!id || !mountedRef.current) {
      return;
    }
    const loaded = await runtime.sessionStore.getSession(id);
    if (!mountedRef.current) {
      return;
    }
    setSession(loaded);
    setError(null);
    if (loaded) {
      setPreparing(true);
      try {
        await runtime.ensureConversation(loaded);
        if (!mountedRef.current) {
          return;
        }
        await runtime.coordinator.onChatFocus(id);
      } catch (err) {
        if (!mountedRef.current) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Engine not ready';
        setError(message);
      } finally {
        if (mountedRef.current) {
          setPreparing(false);
        }
      }
    }
  }, [id, runtime]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const run = async () => {
        if (!id) {
          return;
        }
        const loaded = await runtime.sessionStore.getSession(id);
        if (!active || !mountedRef.current) {
          return;
        }
        setSession(loaded);
        setError(null);
        if (!loaded) {
          return;
        }
        setPreparing(true);
        try {
          await runtime.ensureConversation(loaded);
          if (!active || !mountedRef.current) {
            return;
          }
          await runtime.coordinator.onChatFocus(id);
        } catch (err) {
          if (!active || !mountedRef.current) {
            return;
          }
          const message = err instanceof Error ? err.message : 'Engine not ready';
          setError(message);
        } finally {
          if (active && mountedRef.current) {
            setPreparing(false);
          }
        }
      };
      void run();
      return () => {
        active = false;
        void runtime.coordinator.onChatBlur(id ?? '');
      };
    }, [id, runtime]),
  );

  const waitForApprovalUi = (toolCall: ToolCall, riskLevel: ToolRiskLevel) =>
    new Promise<void>((resolve) => {
      approvalResolvers.current.set(toolCall.id, resolve);
      setPendingApproval({ toolCall, riskLevel });
    });

  const clearApprovalUi = (toolCallId: string) => {
    approvalResolvers.current.get(toolCallId)?.();
    approvalResolvers.current.delete(toolCallId);
    setPendingApproval((current) =>
      current?.toolCall.id === toolCallId ? null : current,
    );
  };

  const send = async () => {
    if (!id || !input.trim() || busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setStreamingText('');
    setStreamingThinking('');

    try {
      for await (const chunk of runtime.sendUserMessage(id, input)) {
        if (!mountedRef.current) {
          break;
        }
        if (chunk.type === 'token') {
          setStreamingText((prev) => prev + chunk.text);
        } else if (chunk.type === 'thinking') {
          setStreamingThinking((prev) => prev + chunk.text);
        } else if (chunk.type === 'tool_approval_required') {
          await waitForApprovalUi(chunk.toolCall, chunk.riskLevel);
        } else if (chunk.type === 'error') {
          setError(chunk.message);
        } else if (chunk.type === 'done') {
          setStreamingText('');
          setStreamingThinking('');
          await loadSession();
        }
      }
      if (mountedRef.current) {
        setInput('');
      }
    } finally {
      setBusy(false);
    }
  };

  const onApproveTool = async () => {
    if (!id || !pendingApproval) {
      return;
    }
    const { toolCall } = pendingApproval;
    await runtime.respondToToolApproval(id, toolCall.id, true);
    clearApprovalUi(toolCall.id);
  };

  const onDenyTool = async () => {
    if (!id || !pendingApproval) {
      return;
    }
    const { toolCall } = pendingApproval;
    await runtime.respondToToolApproval(id, toolCall.id, false, 'User denied');
    clearApprovalUi(toolCall.id);
  };

  return (
    <>
      <Stack.Screen options={{ title: session?.title ?? 'Chat' }} />
      {!session ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {preparing ? (
          <View style={styles.preparingBanner}>
            <ActivityIndicator size="small" color="#444" />
            <Text style={styles.preparingText}>모델 준비 중…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        <View style={styles.messages}>
          <ChatMessageList
            messages={session.messages}
            streamingText={streamingText}
            streamingThinking={streamingThinking}
          />
        </View>
        <ChatInput
          value={input}
          onChangeText={setInput}
          onSend={send}
          disabled={busy || preparing || pendingApproval !== null}
        />
      </KeyboardAvoidingView>
      )}
      <ToolApprovalSheet
        visible={pendingApproval !== null}
        toolCall={pendingApproval?.toolCall ?? null}
        riskLevel={pendingApproval?.riskLevel ?? 'write'}
        onApprove={() => void onApproveTool()}
        onDeny={() => void onDenyTool()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f8',
  },
  messages: {
    flex: 1,
    minHeight: 0,
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
  preparingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eef2ff',
    padding: 10,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
  },
  preparingText: {
    color: '#3730a3',
  },
  errorText: {
    color: '#991b1b',
  },
});
