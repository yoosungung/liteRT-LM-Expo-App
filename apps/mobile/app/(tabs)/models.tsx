import { useCallback, useState } from 'react';
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

  const refresh = useCallback(async () => {
    setLoading(true);
    setStates(await runtime.modelManager.listStates());
    setLoading(false);
  }, [runtime]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const download = async (id: ModelInstallState['id']) => {
    setBusyId(id);
    try {
      const result = await runtime.modelManager.downloadModel(id, () => {
        void refresh();
      });
      if (result.status === 'failed') {
        Alert.alert('Download failed', result.verifyError ?? 'Unknown error');
      }
      await refresh();
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
        Phase 1: E2B/E4B manifest + HF download. Live inference requires verified model +
        Android Engine bridge.
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
            {state.status === 'downloading' && state.progress != null ? (
              <Text style={styles.meta}>
                Progress: {Math.round(state.progress * 100)}%
              </Text>
            ) : null}

            <View style={styles.actions}>
              {state.status === 'verified' ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => remove(entry.id)}
                  disabled={isBusy}
                >
                  <Text style={styles.secondaryLabel}>Delete</Text>
                </Pressable>
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
