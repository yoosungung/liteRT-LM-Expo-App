import { describe, expect, it, vi } from 'vitest';
import { MockEngine } from 'litertlm-native';

import { AgentRuntime } from '../agent/AgentRuntime';
import { PredictiveWarmUpCoordinator } from './PredictiveWarmUpCoordinator';

describe('PredictiveWarmUpCoordinator', () => {
  it('pre-warms a chat session from warm-up deep link', async () => {
    const runtime = new AgentRuntime(new MockEngine());
    const session = await runtime.createSession({ title: 'Warm target' });
    const prepare = vi.fn(async () => {});

    const coordinator = new PredictiveWarmUpCoordinator({
      loadSession: (id) => runtime.sessionStore.getSession(id),
      prepareSession: prepare,
    });

    const warmed = await coordinator.handleRoute({ type: 'warmup', sessionId: session.id });
    expect(warmed).toBe(true);
    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ id: session.id }));
  });

  it('skips duplicate warm-up for the same session', async () => {
    const runtime = new AgentRuntime(new MockEngine());
    const session = await runtime.createSession();
    const prepare = vi.fn(async () => {});

    const coordinator = new PredictiveWarmUpCoordinator({
      loadSession: (id) => runtime.sessionStore.getSession(id),
      prepareSession: prepare,
    });

    await coordinator.handleRoute({ type: 'warmup', sessionId: session.id });
    await coordinator.handleRoute({ type: 'warmup', sessionId: session.id });
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});
