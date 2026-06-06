import { useEffect } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AgentProvider } from '../src/context/AgentContext';
import { JsSkillHostProvider } from '../src/skills/JsSkillHost';
import { resolveEngineMode } from 'litertlm-native';

import { getAgentRuntime } from '../src/agent/AgentRuntime';
import { mapAppState } from '../src/agent/InferenceCoordinator';
import { SecureHfTokenStore, setDefaultHfTokenProvider } from '../src/auth/hfToken';
import { setHfTokenProvider } from '../src/models/ModelManager';
import { parseDeepLink } from '../src/linking/deepLink';

function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = (url: string) => {
      const runtime = getAgentRuntime();
      const route = parseDeepLink(url);
      if (!route) {
        return;
      }

      void runtime.handleDeepLink(url);
      if (route.type === 'chat' && route.sessionId) {
        router.push(`/(tabs)/chat/${route.sessionId}`);
      }
    };

    void Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    });

    const sub = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    const secureStore = new SecureHfTokenStore();
    setDefaultHfTokenProvider(secureStore);
    setHfTokenProvider(secureStore);

    const runtime = getAgentRuntime();
    if (resolveEngineMode() === 'mock') {
      void runtime.initialize();
    }

    const sub = AppState.addEventListener('change', (next) => {
      void runtime.onAppStateChange(mapAppState(next));
    });

    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AgentProvider>
        <JsSkillHostProvider>
          <DeepLinkHandler />
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
                {Platform.OS} · mock · Phase 4
              </Text>
            </View>
          ) : null}
          </View>
        </JsSkillHostProvider>
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
