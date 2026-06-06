/**
 * Mock mode smoke test — verifies MockEngine streaming without native module.
 * Run: pnpm litertlm-native mock-smoke
 */
import { MockEngine } from '../src/mock/MockEngine';
import type { EngineConfig } from '../src/LitertLm.types';

const mockConfig: EngineConfig = {
  mode: 'mock',
  backend: 'cpu',
  mock: {
    tokensPerSecond: 30,
    simulateThinking: false,
  },
  streamBatch: {
    flushIntervalMs: 50,
    maxTokensPerBatch: 8,
  },
};

async function main(): Promise<void> {
  const engine = new MockEngine();
  const conversationId = 'mock-smoke-conv';

  await engine.initialize(mockConfig);
  await engine.createConversation({ conversationId });

  let completed = false;
  const completeSub = engine.addListener('onMessageComplete', (event) => {
    if (event.conversationId === conversationId) {
      completed = true;
    }
  });

  const chunks: string[] = [];
  let full = '';
  for await (const chunk of engine.sendMessage(conversationId, 'Hello mock')) {
    chunks.push(chunk.delta);
    if (chunk.kind === 'token') {
      full += chunk.delta;
    }
  }

  completeSub.remove();
  await engine.shutdown();

  if (!completed) {
    throw new Error('onMessageComplete was not emitted');
  }
  if (full.length === 0) {
    throw new Error('Mock stream produced empty response');
  }
  if (chunks.length === 0) {
    throw new Error('No streamed token chunks received');
  }

  console.log(`mock-smoke OK: ${chunks.length} streamed chunks, ${full.length} chars total`);
}

main().catch((error: unknown) => {
  console.error('mock-smoke FAILED:', error);
  process.exit(1);
});
