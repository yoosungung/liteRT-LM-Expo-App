import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { DEFAULT_SAMPLER } from '../../src/agent/AgentPreferences';
import { useAgentRuntime } from '../../src/context/AgentContext';

export default function SettingsScreen() {
  const runtime = useAgentRuntime();
  const [automaticTools, setAutomaticTools] = useState(true);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [temperature, setTemperature] = useState(String(DEFAULT_SAMPLER.temperature));
  const [topK, setTopK] = useState(String(DEFAULT_SAMPLER.topK));
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const run = async () => {
        const prefs = runtime.agentPreferences;
        const [auto, thinking, sampler] = await Promise.all([
          prefs.getAutomaticToolCalling(),
          prefs.getThinkingEnabled(),
          prefs.getSampler(),
        ]);
        if (!active) {
          return;
        }
        setAutomaticTools(auto);
        setThinkingEnabled(thinking);
        setTemperature(String(sampler.temperature ?? DEFAULT_SAMPLER.temperature));
        setTopK(String(sampler.topK ?? DEFAULT_SAMPLER.topK));
        setLoading(false);
      };
      void run();
      return () => {
        active = false;
      };
    }, [runtime]),
  );

  const toggleAutomaticTools = async (value: boolean) => {
    setAutomaticTools(value);
    await runtime.agentPreferences.setAutomaticToolCalling(value);
  };

  const toggleThinking = async (value: boolean) => {
    setThinkingEnabled(value);
    await runtime.agentPreferences.setThinkingEnabled(value);
  };

  const saveSampler = async (nextTemperature: string, nextTopK: string) => {
    const parsedTemperature = Number(nextTemperature);
    const parsedTopK = Number.parseInt(nextTopK, 10);
    if (!Number.isFinite(parsedTemperature) || !Number.isFinite(parsedTopK)) {
      return;
    }
    await runtime.agentPreferences.setSampler({
      temperature: parsedTemperature,
      topK: parsedTopK,
      topP: 0.95,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Agent</Text>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Automatic tool calling</Text>
          <Text style={styles.hint}>
            ON: native ToolSet loop. OFF: mock manual JS registry (live manual — Phase 2.2+).
          </Text>
        </View>
        <Switch
          value={automaticTools}
          onValueChange={toggleAutomaticTools}
          disabled={loading}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Thinking mode</Text>
          <Text style={styles.hint}>
            Gemma 4 enable_thinking — shows collapsible trace before the answer.
          </Text>
        </View>
        <Switch value={thinkingEnabled} onValueChange={toggleThinking} disabled={loading} />
      </View>

      <Text style={styles.sectionTitle}>Sampler (Prompt Lab lite)</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Temperature</Text>
        <TextInput
          style={styles.input}
          value={temperature}
          onChangeText={setTemperature}
          onEndEditing={() => void saveSampler(temperature, topK)}
          keyboardType="decimal-pad"
          editable={!loading}
        />
        <Text style={styles.fieldLabel}>Top K</Text>
        <TextInput
          style={styles.input}
          value={topK}
          onChangeText={setTopK}
          onEndEditing={() => void saveSampler(temperature, topK)}
          keyboardType="number-pad"
          editable={!loading}
        />
        <Text style={styles.hint}>
          Applied on next conversation open. Defaults: {DEFAULT_SAMPLER.temperature} /{' '}
          {DEFAULT_SAMPLER.topK}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Tool try-outs (mock)</Text>
      <Text style={styles.help}>
        Chat prompts:{'\n'}• "what time is it?" → getCurrentTime{'\n'}• "device info" →
        getDeviceInfo{'\n'}• "open https://example.com" → openUrl (approval)
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f8',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#71717a',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  rowText: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3f3f46',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  hint: {
    fontSize: 13,
    color: '#71717a',
    marginTop: 4,
    lineHeight: 18,
  },
  help: {
    fontSize: 14,
    color: '#3f3f46',
    lineHeight: 22,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
  },
});
