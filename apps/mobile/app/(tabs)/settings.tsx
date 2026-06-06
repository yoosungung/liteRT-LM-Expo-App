import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAgentRuntime } from '../../src/context/AgentContext';

export default function SettingsScreen() {
  const runtime = useAgentRuntime();
  const [automaticTools, setAutomaticTools] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setAutomaticTools(await runtime.agentPreferences.getAutomaticToolCalling());
    setLoading(false);
  }, [runtime]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggleAutomaticTools = async (value: boolean) => {
    setAutomaticTools(value);
    await runtime.agentPreferences.setAutomaticToolCalling(value);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Agent</Text>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Automatic tool calling</Text>
          <Text style={styles.hint}>
            ON: native mock loop (read tools auto-run). OFF: manual JS registry + onToolCall.
          </Text>
        </View>
        <Switch
          value={automaticTools}
          onValueChange={toggleAutomaticTools}
          disabled={loading}
        />
      </View>

      <Text style={styles.sectionTitle}>Mock tool triggers</Text>
      <Text style={styles.help}>
        Try in chat:{'\n'}• "what time is it?" → getCurrentTime{'\n'}• "device info" →
        getDeviceInfo{'\n'}• "open https://example.com" → openUrl (approval required)
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
  rowText: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
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
