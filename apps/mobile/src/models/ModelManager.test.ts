import { File } from 'expo-file-system';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as verifyModel from './verifyModel';
import { ModelManager } from './ModelManager';

async function clearStorage(): Promise<void> {
  const expoFs = await import('expo-file-system');
  (expoFs as { __clearAsyncStorage?: () => void }).__clearAsyncStorage?.();
}

describe('ModelManager', () => {
  beforeEach(async () => {
    await clearStorage();
    vi.restoreAllMocks();
  });

  it('listStates returns not_downloaded by default', async () => {
    const manager = new ModelManager();
    const states = await manager.listStates();
    expect(states.every((s) => s.status === 'not_downloaded')).toBe(true);
  });

  it('getVerifiedModelPath returns null when not verified (§1.8)', async () => {
    const manager = new ModelManager();
    expect(await manager.getVerifiedModelPath('gemma-4-e2b')).toBeNull();
  });

  it('getVerifiedModelPath returns native path when verified and file ready', async () => {
    const manager = new ModelManager();
    const file = verifyModel.modelFile('gemma-4-e2b');
    vi.spyOn(verifyModel, 'isModelFileReady').mockReturnValue(true);
    vi.spyOn(verifyModel, 'modelNativePath').mockReturnValue('/data/gemma-4-e2b.litertlm');

    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(
      '@litertlm/model-install-states',
      JSON.stringify({
        'gemma-4-e2b': {
          id: 'gemma-4-e2b',
          status: 'verified',
          localPath: file.uri,
        },
      }),
    );

    expect(await manager.getVerifiedModelPath('gemma-4-e2b')).toBe('/data/gemma-4-e2b.litertlm');
  });

  it('downloadModel fails without HF token', async () => {
    const saved = process.env.HF_TOKEN;
    const savedPublic = process.env.EXPO_PUBLIC_HF_TOKEN;
    delete process.env.HF_TOKEN;
    delete process.env.EXPO_PUBLIC_HF_TOKEN;
    try {
      const manager = new ModelManager();
      const result = await manager.downloadModel('gemma-4-e2b');
      expect(result.status).toBe('failed');
      expect(result.verifyError).toContain('HF_TOKEN');
    } finally {
      if (saved) process.env.HF_TOKEN = saved;
      if (savedPublic) process.env.EXPO_PUBLIC_HF_TOKEN = savedPublic;
    }
  });

  it('verifyDownloadedModel deletes file on digest failure', async () => {
    const manager = new ModelManager();
    const file = new File({} as never, 'gemma-4-e2b.litertlm');
    const deleteSpy = vi.spyOn(file, 'delete');
    Object.defineProperty(file, 'exists', { value: true });
    Object.defineProperty(file, 'size', { value: 2_588_147_712 });

    vi.spyOn(verifyModel, 'verifyModelSha256').mockResolvedValue({
      ok: false,
      error: 'SHA-256 mismatch',
    });

    const result = await manager.verifyDownloadedModel('gemma-4-e2b', file);
    expect(result.status).toBe('failed');
    expect(deleteSpy).toHaveBeenCalled();
  });
});
