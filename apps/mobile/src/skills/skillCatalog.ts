import type { SkillRef } from './types';

/** Agent Skills progressive disclosure — catalog exposes name + description only (§1.14). */
export const SKILL_CATALOG_PREAMBLE = `## Agent Skills

The following skills extend your capabilities. Review each skill name and description; when the user's request matches a skill, follow that skill's full instructions.

**Important:** Skill names (e.g. \`hash-demo\`) are NOT tool names. Never call a skill name as a tool. JavaScript skills run only via the \`run_js\` tool.

Users may explicitly activate a skill by prefixing a message with \`/skill-name\` or \`/skill:skill-name\`.`;

export interface SkillInvokeDetection {
  skillName: string;
  userText: string;
}

const SLASH_SKILL_PATTERN = /^\/(?:skill:)?([a-z0-9]+(?:-[a-z0-9]+)*)(?:\s+([\s\S]*))?$/;

const DEFAULT_INVOKE_PROMPT = 'Help me using this skill.';

export function formatSkillCatalog(skills: SkillRef[]): string {
  if (skills.length === 0) {
    return '';
  }

  const lines = skills.map((skill) => `- **${skill.name}**: ${skill.description}`);
  return `${SKILL_CATALOG_PREAMBLE}\n\n${lines.join('\n')}`;
}

export function formatActiveSkillBlock(skill: { name: string; instructions: string }): string {
  return `## Active skill: ${skill.name}\n\n${skill.instructions.trim()}`;
}

export function detectSkillInvoke(
  userText: string,
  enabledSkillNames: readonly string[],
): SkillInvokeDetection | null {
  const trimmed = userText.trim();
  const match = trimmed.match(SLASH_SKILL_PATTERN);
  if (!match) {
    return null;
  }

  const skillName = match[1];
  if (!enabledSkillNames.includes(skillName)) {
    return null;
  }

  const body = match[2]?.trim();
  return {
    skillName,
    userText: body && body.length > 0 ? body : DEFAULT_INVOKE_PROMPT,
  };
}
