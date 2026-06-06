import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  createEngine,
  defaultMockConfig,
  resolveEngineMode,
  type EngineStatus,
  type LitertLmEngine,
} from 'litertlm-native';

const CONVERSATION_ID = 'phase0-demo';

export default function App() {
  const engine = useMemo<LitertLmEngine>(() => createEngine(defaultMockConfig()), []);
  const [status, setStatus] = useState<EngineStatus>(engine.getStatus());
  const [input, setInput] = useState('Hello from Phase 0 mock mode');
  const [streamText, setStreamText] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await engine.initialize(defaultMockConfig());
      await engine.createConversation({ conversationId: CONVERSATION_ID });
      if (!cancelled) {
        setReady(true);
        setStatus(engine.getStatus());
      }
    })();

    const statusSub = engine.addListener('onEngineStatusChanged', (next) => {
      setStatus(next);
    });

    return () => {
      cancelled = true;
      statusSub.remove();
      void engine.shutdown();
    };
  }, [engine]);

  const send = useCallback(async () => {
    if (!input.trim() || busy) {
      return;
    }

    setBusy(true);
    setStreamText('');

    try {
      for await (const chunk of engine.sendMessage(CONVERSATION_ID, input)) {
        setStreamText((prev) => prev + chunk);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, engine, input]);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>liteRTLM — Phase 0</Text>
      <Text style={styles.meta}>mode: {resolveEngineMode()}</Text>
      <Text style={styles.meta}>lifecycle: {status.lifecycle}</Text>

      {!ready ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            editable={!busy}
            multiline
          />
          <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={send} disabled={busy}>
            <Text style={styles.buttonLabel}>{busy ? 'Streaming…' : 'Send (mock)'}</Text>
          </Pressable>
          <ScrollView style={styles.outputBox} contentContainerStyle={styles.outputContent}>
            <Text style={styles.output}>{streamText || 'Mock response will stream here.'}</Text>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f8',
    paddingTop: 64,
    paddingHorizontal: 20,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  meta: {
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  outputBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  outputContent: {
    padding: 12,
  },
  output: {
    lineHeight: 22,
  },
});
