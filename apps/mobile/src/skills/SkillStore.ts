import AsyncStorage from '@react-native-async-storage/async-storage';

import type { InstalledSkill } from './types';

const KEY_SKILLS = 'litertlm:skills';

export class SkillStore {
  async load(): Promise<InstalledSkill[]> {
    const raw = await AsyncStorage.getItem(KEY_SKILLS);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as InstalledSkill[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(isValidInstalledSkill);
    } catch {
      return [];
    }
  }

  async save(skills: InstalledSkill[]): Promise<void> {
    await AsyncStorage.setItem(KEY_SKILLS, JSON.stringify(skills));
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(KEY_SKILLS);
  }
}

function isValidInstalledSkill(value: unknown): value is InstalledSkill {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const skill = value as InstalledSkill;
  return (
    typeof skill.frontmatter?.name === 'string' &&
    typeof skill.frontmatter?.description === 'string' &&
    typeof skill.instructions === 'string' &&
    typeof skill.enabled === 'boolean' &&
    typeof skill.installedAt === 'number'
  );
}
