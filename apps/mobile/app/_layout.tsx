import { useEffect } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AgentProvider } from '../src/context/AgentContext';
import { resolveEngineMode } from 'litertlm-native';

import { getAgentRuntime } from '../src/agent/AgentRuntime';
import { mapAppState } from '../src/agent/InferenceCoordinator';

export default function RootLayout() {
  useEffect(() => {
    const runtime = getAgentRuntime();
    if (resolveEngineMode() === 'mock') {
      void runtime.initialize();
    }

    const sub = AppState.addEventListener('change', (next) => {
      void runtime.coordinator.onAppStateChange(mapAppState(next));
    });

    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AgentProvider>
        <View style={styles.root}>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#f7f7f8' },
              headerTitleStyle: { fontWeight: '600' },
              contentStyle: { backgroundColor: '#f7f7f8' },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          {__DEV__ ? (
            <View style={styles.devBadge} pointerEvents="none">
              <Text style={styles.devBadgeText}>
                {Platform.OS} · mock · Phase 1
              </Text>
            </View>
          ) : null}
        </View>
      </AgentProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  devBadge: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  devBadgeText: {
    color: '#fff',
    fontSize: 11,
  },
});
