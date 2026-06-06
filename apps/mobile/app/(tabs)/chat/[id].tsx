import { useCallback, useRef, useState } from 'react';
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
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const approvalResolvers = useRef(new Map<string, () => void>());

  const loadSession = useCallback(async () => {
    if (!id) {
      return;
    }
    const loaded = await runtime.sessionStore.getSession(id);
    setSession(loaded);
    setError(null);
    if (loaded) {
      setPreparing(true);
      try {
        await runtime.ensureConversation(loaded);
        await runtime.coordinator.onChatFocus(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Engine not ready';
        setError(message);
      } finally {
        setPreparing(false);
      }
    }
  }, [id, runtime]);

  useFocusEffect(
    useCallback(() => {
      void loadSession();
      return () => {
        void runtime.coordinator.onChatBlur(id ?? '');
      };
    }, [id, loadSession, runtime]),
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

    try {
      for await (const chunk of runtime.sendUserMessage(id, input)) {
        if (chunk.type === 'token') {
          setStreamingText((prev) => prev + chunk.text);
        } else if (chunk.type === 'tool_approval_required') {
          await waitForApprovalUi(chunk.toolCall, chunk.riskLevel);
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
          <ChatMessageList messages={session.messages} streamingText={streamingText} />
        </View>
        <ChatInput
          value={input}
          onChangeText={setInput}
          onSend={send}
          disabled={busy || preparing || pendingApproval !== null}
        />
      </KeyboardAvoidingView>
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
