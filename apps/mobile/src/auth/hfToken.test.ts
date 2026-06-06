import { describe, expect, it } from 'vitest';

import { MemoryHfTokenProvider, readEnvHfToken, resolveHfDownloadToken } from './hfToken';

describe('hfToken', () => {
  it('prefers env token over stored secure token', async () => {
    const provider = new MemoryHfTokenProvider();
    await provider.setToken('stored-token');

    const token = await resolveHfDownloadToken(provider, () => 'env-token');
    expect(token).toBe('env-token');
  });

  it('falls back to stored token when env is missing', async () => {
    const provider = new MemoryHfTokenProvider();
    await provider.setToken('stored-token');

    const token = await resolveHfDownloadToken(provider, () => undefined);
    expect(token).toBe('stored-token');
  });

  it('readEnvHfToken reads EXPO_PUBLIC_HF_TOKEN first', () => {
    const savedPublic = process.env.EXPO_PUBLIC_HF_TOKEN;
    const saved = process.env.HF_TOKEN;
    process.env.EXPO_PUBLIC_HF_TOKEN = 'public-token';
    process.env.HF_TOKEN = 'private-token';
    expect(readEnvHfToken()).toBe('public-token');
    if (savedPublic) process.env.EXPO_PUBLIC_HF_TOKEN = savedPublic;
    else delete process.env.EXPO_PUBLIC_HF_TOKEN;
    if (saved) process.env.HF_TOKEN = saved;
    else delete process.env.HF_TOKEN;
  });
});
