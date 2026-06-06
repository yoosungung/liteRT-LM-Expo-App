import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAgentRuntime } from '../../src/context/AgentContext';
import type { StoredSession } from '../../src/storage/SessionStore';

export default function ChatListScreen() {
  const runtime = useAgentRuntime();
  const router = useRouter();
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await runtime.sessionStore.listSessions();
    setSessions(list);
    setLoading(false);
  }, [runtime]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const run = async () => {
        if (!active) {
          return;
        }
        setLoading(true);
        const list = await runtime.sessionStore.listSessions();
        if (!active) {
          return;
        }
        setSessions(list);
        setLoading(false);
      };
      void run();
      return () => {
        active = false;
      };
    }, [runtime]),
  );

  const startNewChat = async () => {
    setCreating(true);
    try {
      const session = await runtime.createSession();
      router.push(`/chat/${session.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>mode: {runtime.getEngineMode()}</Text>
        <Pressable style={styles.newButton} onPress={startNewChat} disabled={creating}>
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.newButtonLabel}>New chat</Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyBody}>
            Start a chat in mock mode — no model download required.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/chat/${item.id}`)}
            >
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowMeta}>
                {item.messages.length} messages · {item.modelId}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f8',
  },
  header: {
    padding: 16,
    gap: 12,
  },
  subtitle: {
    color: '#666',
  },
  newButton: {
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  newButtonLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  loader: {
    marginTop: 40,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyBody: {
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  rowTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  rowMeta: {
    color: '#777',
    fontSize: 13,
  },
});
