import { beforeEach, describe, expect, it } from 'vitest';

async function clearStorage(): Promise<void> {
  const expoFs = await import('expo-file-system');
  (expoFs as { __clearAsyncStorage?: () => void }).__clearAsyncStorage?.();
}

import { createSessionId, SessionStore, type StoredSession } from './SessionStore';

function baseSession(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    id: 's1',
    title: 'Test',
    modelId: 'gemma-4-e2b',
    messages: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('SessionStore', () => {
  beforeEach(async () => {
    await clearStorage();
  });

  it('listSessions returns empty when storage is empty', async () => {
    const store = new SessionStore();
    expect(await store.listSessions()).toEqual([]);
  });

  it('saveSession and getSession round-trip', async () => {
    const store = new SessionStore();
    const session = baseSession();
    await store.saveSession(session);
    expect(await store.getSession('s1')).toMatchObject({ id: 's1', title: 'Test' });
  });

  it('appendMessage adds message and derives title from first user turn', async () => {
    const store = new SessionStore();
    await store.saveSession(baseSession({ title: '' }));
    const updated = await store.appendMessage('s1', {
      id: 'm1',
      role: 'user',
      content: 'Hello session',
      timestamp: 2,
    });
    expect(updated.messages).toHaveLength(1);
    expect(updated.title).toBe('Hello session');
  });

  it('deleteSession removes session', async () => {
    const store = new SessionStore();
    await store.saveSession(baseSession());
    await store.deleteSession('s1');
    expect(await store.getSession('s1')).toBeNull();
  });

  it('listSessions throws on corrupt JSON', async () => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('@litertlm/sessions', '{not-json');
    const store = new SessionStore();
    await expect(store.listSessions()).rejects.toThrow();
  });

  it('createSessionId generates unique ids', () => {
    const a = createSessionId();
    const b = createSessionId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^session-/);
  });
});
