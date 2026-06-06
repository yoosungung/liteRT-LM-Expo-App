import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { modelSupportsImage } from '../../../src/media/imageAttachment';
import { pickChatImage } from '../../../src/media/pickChatImage';
import type { StoredSession } from '../../../src/storage/SessionStore';
import type { ChatPreparePhase } from '../../../src/agent/InferenceCoordinator';

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
  const [preparePhase, setPreparePhase] = useState<ChatPreparePhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [pendingImage, setPendingImage] = useState<{ uri: string; nativePath: string } | null>(
    null,
  );
  const approvalResolvers = useRef(new Map<string, () => void>());
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runPrepare = useCallback(
    async (loaded: StoredSession) => {
      setPreparePhase('loading');
      try {
        await runtime.prepareChatSession(loaded, setPreparePhase);
      } finally {
        setPreparePhase(null);
      }
    },
    [runtime],
  );

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
      try {
        await runPrepare(loaded);
      } catch (err) {
        if (!mountedRef.current) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Engine not ready';
        setError(message);
      }
    }
  }, [id, runPrepare, runtime]);

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
        try {
          await runPrepare(loaded);
        } catch (err) {
          if (!active || !mountedRef.current) {
            return;
          }
          const message = err instanceof Error ? err.message : 'Engine not ready';
          setError(message);
        }
      };
      void run();
      return () => {
        active = false;
        void (async () => {
          const current = await runtime.sessionStore.getSession(id ?? '');
          void runtime.coordinator.onChatBlur(id ?? '', current?.messages.length ?? 0);
        })();
      };
    }, [id, runPrepare, runtime]),
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

  const send = async (options?: { imageUri?: string; imagePath?: string }) => {
    const imagePath = options?.imagePath ?? pendingImage?.nativePath;
    const imageUri = options?.imageUri ?? pendingImage?.uri;
    if ((!input.trim() && !imagePath) || busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setStreamingText('');
    setStreamingThinking('');

    try {
      for await (const chunk of runtime.sendUserMessage(id!, input, { imageUri, imagePath })) {
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
          if (chunk.message !== 'Generation aborted') {
            setError(chunk.message);
          }
        } else if (chunk.type === 'done') {
          setStreamingText('');
          setStreamingThinking('');
          await loadSession();
        }
      }
      if (mountedRef.current) {
        setInput('');
        setPendingImage(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const attachImage = async (source: 'camera' | 'library') => {
    if (!session || busy) {
      return;
    }
    try {
      const picked = await pickChatImage(source);
      if (picked) {
        setPendingImage(picked);
        setError(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pick image';
      setError(message);
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
        {preparePhase ? (
          <View style={styles.preparingBanner}>
            <ActivityIndicator size="small" color="#444" />
            <Text style={styles.preparingText}>
              {preparePhase === 'restoring' ? '문맥을 복원하는 중…' : '모델 준비 중…'}
            </Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {pendingImage ? (
          <View style={styles.pendingImageBanner}>
            <Text style={styles.pendingImageText}>Image attached — add a prompt or send as-is.</Text>
            <Pressable onPress={() => setPendingImage(null)}>
              <Text style={styles.pendingImageRemove}>Remove</Text>
            </Pressable>
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
          onSend={() => void send()}
          onPickImage={() => void attachImage('library')}
          onTakePhoto={() => void attachImage('camera')}
          imageEnabled={modelSupportsImage(session.modelId)}
          canSendWithMedia={pendingImage !== null}
          onStop={() => runtime.abortGeneration(id!)}
          streaming={busy}
          disabled={preparePhase !== null || pendingApproval !== null}
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
  pendingImageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#ecfdf5',
    padding: 10,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
  },
  pendingImageText: {
    flex: 1,
    color: '#065f46',
  },
  pendingImageRemove: {
    color: '#047857',
    fontWeight: '600',
  },
});
