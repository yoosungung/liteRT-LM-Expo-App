export type SkillKind = 'text' | 'javascript' | 'native';

export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  'allowed-tools'?: string;
}

export interface SkillSource {
  type: 'bundled' | 'url' | 'file';
  uri: string;
}

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  instructions: string;
  kind: SkillKind;
  source: SkillSource;
  scriptHtml?: string;
}

export interface SkillRef {
  name: string;
  description: string;
}

export interface InstalledSkill extends ParsedSkill {
  enabled: boolean;
  installedAt: number;
}

export type SkillParseResult = ParsedSkill | { error: string };

export type SkillImportUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };
