import { describe, expect, it, vi } from 'vitest';
import { MockEngine } from 'litertlm-native';

import {
  InferenceCoordinator,
  mapAppState,
  resolveIdleTimeoutMs,
} from './InferenceCoordinator';

describe('InferenceCoordinator helpers', () => {
  it('resolveIdleTimeoutMs prefers explicit policy', () => {
    expect(resolveIdleTimeoutMs(60_000)).toBe(60_000);
  });

  it('resolveIdleTimeoutMs defaults to 300_000', () => {
    expect(resolveIdleTimeoutMs()).toBe(300_000);
  });

  it('mapAppState maps react-native statuses', () => {
    expect(mapAppState('active')).toBe('active');
    expect(mapAppState('background')).toBe('background');
    expect(mapAppState('inactive')).toBe('inactive');
  });
});

describe('InferenceCoordinator lifecycle (§1.12)', () => {
  it('onAppStateChange active triggers warmUp when config has modelPath', async () => {
    const engine = new MockEngine();
    const warmUp = vi.spyOn(engine, 'warmUp');
    await engine.initialize({ mode: 'mock', backend: 'cpu' });
    await engine.hibernate();

    const coordinator = new InferenceCoordinator(engine);
    coordinator.setLastEngineConfig({
      mode: 'mock',
      backend: 'cpu',
      modelPath: '/mock/model.litertlm',
    });

    await coordinator.onAppStateChange('active');
    expect(warmUp).toHaveBeenCalled();
  });

  it('onAppStateChange background enters idle and schedules hibernate', async () => {
    const engine = new MockEngine();
    const enterIdle = vi.spyOn(engine, 'enterIdle');
    const hibernate = vi.spyOn(engine, 'hibernate');
    await engine.initialize({ mode: 'mock', backend: 'cpu' });

    const coordinator = new InferenceCoordinator(engine, { idleTimeoutMs: 50 });
    await coordinator.onAppStateChange('background');
    expect(enterIdle).toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(hibernate).toHaveBeenCalled();
  });

  it('onChatFocus restores session and replays messages when needed', async () => {
    const engine = new MockEngine();
    await engine.initialize({
      mode: 'mock',
      backend: 'cpu',
      mock: { tokensPerSecond: 10_000 },
    });
    await engine.createConversation({ conversationId: 'conv-1' });
    await engine.persistSession('conv-1', { messageCount: 2 });

    const sendMessageSync = vi.spyOn(engine, 'sendMessageSync');
    const phases: string[] = [];

    const coordinator = new InferenceCoordinator(engine);
    coordinator.setLastEngineConfig({ mode: 'mock', backend: 'cpu' });

    await coordinator.onChatFocus(
      'conv-1',
      {
        id: 'conv-1',
        title: 't',
        modelId: 'gemma-4-e2b',
        messages: [
          { id: 'u1', role: 'user', content: 'hi', timestamp: 1 },
          { id: 'a1', role: 'assistant', content: 'hello', timestamp: 2 },
        ],
        createdAt: 1,
        updatedAt: 2,
      },
      (phase) => phases.push(phase),
    );

    expect(phases).toContain('ready');
    expect(sendMessageSync).toHaveBeenCalled();
  });
});
