import { beforeEach, describe, expect, it } from 'vitest';

import { AgentPreferences, DEFAULT_SAMPLER } from './AgentPreferences';

async function clearStorage(): Promise<void> {
  const expoFs = await import('expo-file-system');
  (expoFs as { __clearAsyncStorage?: () => void }).__clearAsyncStorage?.();
}

describe('AgentPreferences', () => {
  beforeEach(async () => {
    await clearStorage();
  });

  it('returns default sampler', async () => {
    const prefs = new AgentPreferences();
    expect(await prefs.getSampler()).toEqual(DEFAULT_SAMPLER);
  });

  it('persists sampler overrides', async () => {
    const prefs = new AgentPreferences();
    await prefs.setSampler({ temperature: 0.2, topK: 10 });
    expect(await prefs.getSampler()).toEqual({ temperature: 0.2, topK: 10 });
  });

  it('automaticToolCalling defaults to true', async () => {
    const prefs = new AgentPreferences();
    expect(await prefs.getAutomaticToolCalling()).toBe(true);
  });

  it('automaticToolCalling can be disabled', async () => {
    const prefs = new AgentPreferences();
    await prefs.setAutomaticToolCalling(false);
    expect(await prefs.getAutomaticToolCalling()).toBe(false);
  });

  it('thinking toggle persists', async () => {
    const prefs = new AgentPreferences();
    await prefs.setThinkingEnabled(true);
    expect(await prefs.getThinkingEnabled()).toBe(true);
  });
});
