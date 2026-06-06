import type {
  ParsedSkill,
  SkillFrontmatter,
  SkillImportUrlResult,
  SkillKind,
  SkillParseResult,
  SkillSource,
} from './types';

const DEFAULT_SOURCE: SkillSource = { type: 'file', uri: 'inline://skill' };

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ParseSkillOptions {
  source?: SkillSource;
}

export interface SkillParser {
  parseSkillMarkdown(content: string, options?: ParseSkillOptions): SkillParseResult;
  validateSkillImportUrl(url: string): SkillImportUrlResult;
}

export function createSkillParser(): SkillParser {
  return {
    parseSkillMarkdown(content, options) {
      const split = splitFrontmatter(content);
      if ('error' in split) {
        return split;
      }

      const fields = parseSimpleYaml(split.frontmatterRaw);
      const name = fields.name?.trim() ?? '';
      const description = fields.description?.trim() ?? '';

      const nameError = validateSkillName(name);
      if (nameError) {
        return { error: nameError };
      }

      if (description.length < 1 || description.length > 1024) {
        return { error: 'Skill description is required (1-1024 characters)' };
      }

      const frontmatter: SkillFrontmatter = {
        name,
        description,
      };

      if (fields.license) frontmatter.license = fields.license;
      if (fields.compatibility) frontmatter.compatibility = fields.compatibility;
      if (fields['allowed-tools']) frontmatter['allowed-tools'] = fields['allowed-tools'];

      const instructions = split.body;
      const kind = detectSkillKind(instructions);

      return {
        frontmatter,
        instructions,
        kind,
        source: options?.source ?? DEFAULT_SOURCE,
      };
    },

    validateSkillImportUrl(url) {
      let parsed: URL;
      try {
        parsed = new URL(url.trim());
      } catch {
        return { ok: false, error: 'Invalid skill import URL' };
      }

      if (parsed.protocol !== 'https:') {
        return { ok: false, error: 'Skill import URL must use HTTPS' };
      }

      return { ok: true, url: parsed.toString() };
    },
  };
}

function splitFrontmatter(content: string): { frontmatterRaw: string; body: string } | { error: string } {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return { error: 'SKILL.md must start with YAML frontmatter (---)' };
  }

  const closingIndex = trimmed.indexOf('\n---', 3);
  if (closingIndex === -1) {
    return { error: 'SKILL.md frontmatter must be closed with ---' };
  }

  const frontmatterRaw = trimmed.slice(3, closingIndex).trim();
  const body = trimmed.slice(closingIndex + 4).replace(/^\r?\n/, '').trimEnd();

  return { frontmatterRaw, body };
}

function parseSimpleYaml(raw: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf(':');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
}

function validateSkillName(name: string): string | undefined {
  if (name.length < 1 || name.length > 64 || !NAME_PATTERN.test(name)) {
    return 'Invalid skill name: must be lowercase kebab-case (1-64 chars)';
  }
  return undefined;
}

function detectSkillKind(instructions: string): SkillKind {
  if (/\brun_js\b/.test(instructions)) {
    return 'javascript';
  }
  return 'text';
}
