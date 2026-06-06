import { describe, expect, it, beforeEach } from 'vitest';

import { createBundledInstalledSkills } from './bundledSkills';
import { SkillStore } from './SkillStore';

async function clearStorage(): Promise<void> {
  const expoFs = await import('expo-file-system');
  (expoFs as { __clearAsyncStorage?: () => void }).__clearAsyncStorage?.();
}

describe('SkillStore', () => {
  beforeEach(async () => {
    await clearStorage();
  });

  it('load returns empty array when unset', async () => {
    const store = new SkillStore();
    expect(await store.load()).toEqual([]);
  });

  it('save and load round-trips installed skills', async () => {
    const store = new SkillStore();
    const skills = createBundledInstalledSkills(1_700_000_000_000).filter(
      (skill) => skill.frontmatter.name === 'fitness-coach',
    );
    await store.save(skills);
    expect(await store.load()).toEqual(skills);
  });

  it('load ignores corrupt JSON', async () => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('litertlm:skills', '{not json');
    const store = new SkillStore();
    expect(await store.load()).toEqual([]);
  });
});
