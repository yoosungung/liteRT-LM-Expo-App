import { beforeEach, describe, expect, it } from 'vitest';

import { ModelPreferences } from './ModelPreferences';

async function clearStorage(): Promise<void> {
  const expoFs = await import('expo-file-system');
  (expoFs as { __clearAsyncStorage?: () => void }).__clearAsyncStorage?.();
}

describe('ModelPreferences', () => {
  beforeEach(async () => {
    await clearStorage();
  });

  it('getLastUsed returns null initially', async () => {
    const prefs = new ModelPreferences();
    expect(await prefs.getLastUsed()).toBeNull();
    expect(await prefs.getLastUsedModelId()).toBeNull();
  });

  it('setLastUsed persists model and backend', async () => {
    const prefs = new ModelPreferences();
    await prefs.setLastUsed('gemma-4-e4b', 'gpu');
    const saved = await prefs.getLastUsed();
    expect(saved?.modelId).toBe('gemma-4-e4b');
    expect(saved?.backend).toBe('gpu');
    expect(await prefs.getLastUsedModelId()).toBe('gemma-4-e4b');
  });
});
