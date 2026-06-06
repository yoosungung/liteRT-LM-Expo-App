import { describe, expect, it } from 'vitest';

import { MockEngine } from './MockEngine';

const fastConfig = {
  mode: 'mock' as const,
  backend: 'cpu' as const,
  mock: { tokensPerSecond: 10_000, simulateThinking: false },
  streamBatch: { flushIntervalMs: 1, maxTokensPerBatch: 64 },
};

async function collectTokens(engine: MockEngine, conversationId: string, text: string) {
  let full = '';
  let completed = false;
  const sub = engine.addListener('onMessageComplete', (event) => {
    if (event.conversationId === conversationId) {
      completed = true;
    }
  });

  for await (const chunk of engine.sendMessage(conversationId, text)) {
    if (chunk.kind === 'token') {
      full += chunk.delta;
    }
  }

  sub.remove();
  return { full, completed };
}

describe('MockEngine streaming', () => {
  it('streams canned response and emits onMessageComplete (mock-smoke)', async () => {
    const engine = new MockEngine();
    const conversationId = 'mock-smoke-conv';

    await engine.initialize(fastConfig);
    await engine.createConversation({ conversationId });

    const { full, completed } = await collectTokens(engine, conversationId, 'Hello mock');
    await engine.shutdown();

    expect(completed).toBe(true);
    expect(full.length).toBeGreaterThan(0);
    expect(full).toContain('Hello mock');
  });

  it('streams thinking chunks when enable_thinking is set', async () => {
    const engine = new MockEngine();
    const conversationId = 'thinking-conv';

    await engine.initialize(fastConfig);
    await engine.createConversation({ conversationId });

    const thinking: string[] = [];
    for await (const chunk of engine.sendMessage(conversationId, 'hello', {
      enable_thinking: true,
    })) {
      if (chunk.kind === 'thinking') {
        thinking.push(chunk.delta);
      }
    }
    await engine.shutdown();

    expect(thinking.join('')).toContain('think');
  });
});
