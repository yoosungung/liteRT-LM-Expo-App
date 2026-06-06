import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAgentRuntime } from '../../src/context/AgentContext';
import { MODEL_MANIFEST, type ModelInstallState } from '../../src/models/manifest';

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  }
  return `${Math.round(bytes / 1_000_000)} MB`;
}

export default function ModelsScreen() {
  const runtime = useAgentRuntime();
  const [states, setStates] = useState<ModelInstallState[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const engineMode = useMemo(() => runtime.getEngineMode(), [runtime]);

  const loadStates = useCallback(async () => {
    setStates(await runtime.modelManager.listStates());
  }, [runtime]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadStates();
    setLoading(false);
  }, [loadStates]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const patchState = useCallback((id: ModelInstallState['id'], patch: Partial<ModelInstallState>) => {
    setStates((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch, id } : s)),
    );
  }, []);

  const download = async (id: ModelInstallState['id']) => {
    setBusyId(id);
    patchState(id, {
      status: 'downloading',
      progress: 0,
      bytesDownloaded: 0,
      verifyError: undefined,
    });
    try {
      const result = await runtime.modelManager.downloadModel(id, (update) => {
        patchState(id, {
          status: update.status ?? 'downloading',
          progress: update.progress,
          bytesDownloaded: update.bytesDownloaded,
        });
      });
      if (result.status === 'failed') {
        Alert.alert('Download failed', result.verifyError ?? 'Unknown error');
      }
      await loadStates();
    } finally {
      setBusyId(null);
    }
  };

  const useModel = async (id: ModelInstallState['id']) => {
    setBusyId(id);
    try {
      const { backend } = await runtime.loadModel(id, 'gpu');
      Alert.alert(
        'Model loaded',
        `Gemma 4 ${id} is ready (${engineMode} mode, ${backend} backend). Open Chats to start inference.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Load failed';
      Alert.alert(
        'Load failed',
        `${message}\n\nTip: Android emulator often needs CPU backend (auto-fallback after GPU).`,
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: ModelInstallState['id']) => {
    setBusyId(id);
    try {
      await runtime.modelManager.deleteModel(id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.lead}>
        Engine mode: {engineMode}. Download E2B, verify SHA-256, then tap Use for chat. Live mode
        needs Android dev build + EXPO_PUBLIC_LITERTLM_MODE=live.
      </Text>

      {MODEL_MANIFEST.map((entry) => {
        const state = states.find((s) => s.id === entry.id) ?? {
          id: entry.id,
          status: 'not_downloaded' as const,
        };
        const isBusy = busyId === entry.id;

        return (
          <View key={entry.id} style={styles.card}>
            <Text style={styles.title}>{entry.displayName}</Text>
            <Text style={styles.meta}>{entry.id}</Text>
            <Text style={styles.meta}>
              {formatBytes(entry.sizeBytes)} · min RAM {entry.minRamMb} MB
            </Text>
            <Text style={styles.status}>Status: {state.status}</Text>
            {state.verifyError ? (
              <Text style={styles.error}>{state.verifyError}</Text>
            ) : null}
            {state.status === 'downloading' ? (
              <View style={styles.progressBlock}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.max((state.progress ?? 0) * 100, state.bytesDownloaded ? 0.5 : 0)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.meta}>
                  Downloading… {formatBytes(state.bytesDownloaded ?? 0)} /{' '}
                  {formatBytes(entry.sizeBytes)} ({((state.progress ?? 0) * 100).toFixed(1)}%)
                </Text>
              </View>
            ) : null}
            {state.status === 'verifying' ? (
              <View style={styles.progressBlock}>
                <ActivityIndicator size="small" />
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round((state.progress ?? 0) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.meta}>
                  Verifying SHA-256… {formatBytes(state.bytesDownloaded ?? 0)} /{' '}
                  {formatBytes(entry.sizeBytes)} ({((state.progress ?? 0) * 100).toFixed(0)}%)
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              {state.status === 'verified' ? (
                <>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => useModel(entry.id)}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryLabel}>Use for chat</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => remove(entry.id)}
                    disabled={isBusy}
                  >
                    <Text style={styles.secondaryLabel}>Delete</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => download(entry.id)}
                  disabled={isBusy || state.status === 'downloading'}
                >
                  {isBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryLabel}>Download</Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lead: {
    color: '#555',
    lineHeight: 22,
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ececec',
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  meta: {
    color: '#666',
    fontSize: 13,
  },
  status: {
    fontWeight: '500',
    marginTop: 4,
  },
  error: {
    color: '#b91c1c',
    fontSize: 13,
  },
  progressBlock: {
    gap: 6,
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e5e5e5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#111',
    borderRadius: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryLabel: {
    fontWeight: '600',
  },
});
