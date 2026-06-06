import type { InstalledSkill, ParsedSkill, SkillRef } from './types';

export class SkillRegistry {
  private skills = new Map<string, InstalledSkill>();

  register(skill: ParsedSkill): void {
    const name = skill.frontmatter.name;
    if (this.skills.has(name)) {
      throw new Error(`Skill already registered: ${name}`);
    }

    this.skills.set(name, {
      ...skill,
      enabled: true,
      installedAt: Date.now(),
    });
  }

  hydrateInstalled(skills: InstalledSkill[]): void {
    this.skills.clear();
    for (const skill of skills) {
      this.skills.set(skill.frontmatter.name, skill);
    }
  }

  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  list(): InstalledSkill[] {
    return [...this.skills.values()].sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name));
  }

  listEnabledRefs(): SkillRef[] {
    return this.list()
      .filter((skill) => skill.enabled)
      .map((skill) => ({
        name: skill.frontmatter.name,
        description: skill.frontmatter.description,
      }));
  }

  get(name: string): InstalledSkill | undefined {
    return this.skills.get(name);
  }

  setEnabled(name: string, enabled: boolean): boolean {
    const skill = this.skills.get(name);
    if (!skill) {
      return false;
    }
    skill.enabled = enabled;
    return true;
  }
}
