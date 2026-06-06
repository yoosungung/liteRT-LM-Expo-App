import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { resolveEngineMode } from 'litertlm-native';

import {
  formatBenchmarkModelLabel,
  runBenchmark,
  type BenchmarkMetrics,
} from '../../src/benchmark/runBenchmark';
import { useAgentRuntime } from '../../src/context/AgentContext';
import { meetsMinRamForModel, ramGateMessage } from '../../src/models/deviceRam';
import { MODEL_MANIFEST, type ModelId } from '../../src/models/manifest';

function formatMs(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return `${value.toFixed(0)} ms`;
}

function formatRate(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return `${value.toFixed(1)} tok/s (est.)`;
}

export default function BenchmarkScreen() {
  const runtime = useAgentRuntime();
  const engineMode = useMemo(() => resolveEngineMode(), []);
  const [busyModelId, setBusyModelId] = useState<ModelId | null>(null);
  const [results, setResults] = useState<Partial<Record<ModelId, BenchmarkMetrics>>>({});
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (modelId: ModelId) => {
      if (engineMode === 'live' && !meetsMinRamForModel(modelId)) {
        setError(ramGateMessage(modelId));
        return;
      }

      setBusyModelId(modelId);
      setError(null);
      try {
        const metrics = await runBenchmark(runtime, modelId);
        setResults((prev) => ({ ...prev, [modelId]: metrics }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Benchmark failed');
      } finally {
        setBusyModelId(null);
      }
    },
    [engineMode, runtime],
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.lead}>
        1-turn fixed prompt benchmark. TTFT and decode rate are measured with JS wall clock
        {engineMode === 'mock' ? ' (mock placeholder).' : ' on live engine.'}
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {MODEL_MANIFEST.map((entry) => {
        const ramBlocked = engineMode === 'live' && !meetsMinRamForModel(entry.id);
        const ramMessage = ramBlocked ? ramGateMessage(entry.id) : null;
        const metrics = results[entry.id];
        const isBusy = busyModelId === entry.id;

        return (
          <View key={entry.id} style={styles.card}>
            <Text style={styles.title}>{entry.displayName}</Text>
            <Text style={styles.meta}>{formatBenchmarkModelLabel(entry.id)}</Text>
            {ramMessage ? <Text style={styles.warning}>{ramMessage}</Text> : null}

            {metrics ? (
              <View style={styles.metrics}>
                <Text style={styles.metricRow}>TTFT: {formatMs(metrics.ttftMs)}</Text>
                <Text style={styles.metricRow}>Total: {formatMs(metrics.totalMs)}</Text>
                <Text style={styles.metricRow}>Decode: {formatRate(metrics.tokensPerSecond)}</Text>
                <Text style={styles.metricRow}>
                  Backend: {metrics.backend ?? 'n/a'} · mode: {metrics.engineMode}
                  {metrics.placeholder ? ' (mock)' : ''}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.button, (isBusy || ramBlocked) && styles.buttonDisabled]}
              onPress={() => void run(entry.id)}
              disabled={isBusy || ramBlocked}
            >
              {isBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonLabel}>Run benchmark</Text>
              )}
            </Pressable>
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
  lead: {
    color: '#555',
    lineHeight: 22,
    marginBottom: 4,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    color: '#991b1b',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ececec',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  meta: {
    color: '#666',
    fontSize: 13,
  },
  warning: {
    color: '#b45309',
    fontSize: 13,
    lineHeight: 18,
  },
  metrics: {
    backgroundColor: '#f4f4f5',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  metricRow: {
    fontSize: 14,
    color: '#27272a',
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '600',
  },
});
