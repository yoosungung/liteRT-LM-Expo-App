import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAgentRuntime } from '../../src/context/AgentContext';
import type { McpServerConfig } from '../../src/mcp/types';
import { validateMcpServerId, validateMcpServerUrl } from '../../src/mcp/validateMcpUrl';

export default function ConnectedScreen() {
  const runtime = useAgentRuntime();
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [serverId, setServerId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    await runtime.ensureMcpLoaded();
    setServers(runtime.listMcpServers());
    setLoading(false);
  }, [runtime]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const addServer = async () => {
    const idError = validateMcpServerId(serverId);
    if (idError) {
      Alert.alert('Invalid server id', idError);
      return;
    }

    const urlResult = validateMcpServerUrl(serverUrl);
    if (!urlResult.ok) {
      Alert.alert('Invalid MCP URL', urlResult.error);
      return;
    }

    try {
      await runtime.registerMcpServer({
        id: serverId.trim(),
        displayName: displayName.trim() || serverId.trim(),
        url: urlResult.url,
        enabled: true,
      });
      await runtime.syncMcpServer(serverId.trim());
      setServerId('');
      setDisplayName('');
      setServerUrl('');
      await refresh();
      Alert.alert('MCP server added', 'Tools synced into the on-device catalog.');
    } catch (error) {
      Alert.alert('Registration failed', error instanceof Error ? error.message : String(error));
    }
  };

  const toggleServer = async (id: string, enabled: boolean) => {
    setServers((prev) => prev.map((server) => (server.id === id ? { ...server, enabled } : server)));
    await runtime.setMcpServerEnabled(id, enabled);
    await refresh();
  };

  const syncServer = async (id: string) => {
    setSyncingId(id);
    try {
      const count = await runtime.syncMcpServer(id);
      Alert.alert('Sync complete', `${count} tool(s) refreshed.`);
      await refresh();
    } catch (error) {
      Alert.alert('Sync failed', error instanceof Error ? error.message : String(error));
    } finally {
      setSyncingId(null);
    }
  };

  const removeServer = (id: string) => {
    Alert.alert('Remove MCP server', `Remove "${id}" from this device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await runtime.removeMcpServer(id);
            await refresh();
          })();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>MCP Server (Streamable HTTP)</Text>
      <View style={styles.card}>
        <Text style={styles.hint}>
          Register an HTTPS MCP endpoint. Tool schemas are injected into the on-device system prompt;
          execution uses network only when the model invokes a tool (§1.15).
        </Text>
        <TextInput
          style={styles.input}
          value={serverId}
          onChangeText={setServerId}
          placeholder="server-id (kebab-case)"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
        />
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="https://mcp.example.com/v1"
          autoCapitalize="none"
          keyboardType="url"
        />
        <Pressable style={styles.primaryButton} onPress={() => void addServer()}>
          <Text style={styles.primaryButtonText}>Add MCP server</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Registered servers</Text>
      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : servers.length === 0 ? (
        <Text style={styles.empty}>No MCP servers registered.</Text>
      ) : (
        servers.map((server) => (
          <View key={server.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>{server.displayName}</Text>
              <Text style={styles.description}>{server.url}</Text>
              <Text style={styles.mono}>id: {server.id}</Text>
            </View>
            <View style={styles.rowActions}>
              <Switch value={server.enabled} onValueChange={(value) => void toggleServer(server.id, value)} />
              <Pressable onPress={() => void syncServer(server.id)} disabled={syncingId === server.id}>
                <Text style={styles.linkText}>{syncingId === server.id ? 'Syncing…' : 'Sync tools'}</Text>
              </Pressable>
              <Pressable onPress={() => removeServer(server.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Try it (mock)</Text>
      <Text style={styles.help}>
        Add server id <Text style={styles.mono}>weather</Text> with any HTTPS URL, then chat:{'\n'}
        <Text style={styles.mono}>mcp weather seoul</Text>
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f8' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#71717a',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 12, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  rowText: { flex: 1, gap: 4 },
  rowActions: { alignItems: 'flex-end', gap: 8 },
  label: { fontSize: 16, fontWeight: '600', color: '#111' },
  description: { fontSize: 13, color: '#3f3f46' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  primaryButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 13, color: '#71717a', lineHeight: 18 },
  help: {
    fontSize: 14,
    color: '#3f3f46',
    lineHeight: 22,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
  },
  empty: {
    fontSize: 14,
    color: '#71717a',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
  },
  loader: { marginVertical: 12 },
  linkText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  removeText: { fontSize: 13, color: '#dc2626', fontWeight: '600' },
  mono: { fontFamily: 'Menlo', fontSize: 13, color: '#18181b' },
});
