import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createSkillParser } from './SkillParser';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const sampleSkill = readFileSync(join(fixtureDir, 'fixtures/sample-text-skill.md'), 'utf8');

describe('SkillParser', () => {
  const parser = createSkillParser();

  it('parses frontmatter and instructions body from SKILL.md', () => {
    const result = parser.parseSkillMarkdown(sampleSkill, {
      source: { type: 'bundled', uri: 'bundled://fitness-coach' },
    });

    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.frontmatter.name).toBe('fitness-coach');
    expect(result.frontmatter.description).toContain('fitness coach');
    expect(result.instructions).toContain('# Cheerful Fitness Coach');
    expect(result.instructions).toContain('15-minute routine');
    expect(result.kind).toBe('text');
  });

  it('rejects SKILL.md without frontmatter delimiters', () => {
    const result = parser.parseSkillMarkdown('# No frontmatter\n\nBody only.');
    expect(result).toEqual({ error: 'SKILL.md must start with YAML frontmatter (---)' });
  });

  it('rejects invalid skill name (uppercase)', () => {
    const content = `---
name: Fitness-Coach
description: Invalid name casing.
---

# Body
`;
    const result = parser.parseSkillMarkdown(content);
    expect(result).toEqual({
      error: 'Invalid skill name: must be lowercase kebab-case (1-64 chars)',
    });
  });

  it('rejects missing or empty description', () => {
    const content = `---
name: no-description
description:
---

# Body
`;
    const result = parser.parseSkillMarkdown(content);
    expect(result).toEqual({ error: 'Skill description is required (1-1024 characters)' });
  });

  it('detects javascript kind when body references run_js', () => {
    const content = `---
name: hash-skill
description: Computes a hash via run_js tool.
---

Call the \`run_js\` tool with the user text.
`;
    const result = parser.parseSkillMarkdown(content);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.kind).toBe('javascript');
  });

  it('validateSkillImportUrl accepts https SKILL.md URLs', () => {
    expect(
      parser.validateSkillImportUrl(
        'https://raw.githubusercontent.com/google-ai-edge/gallery/main/skills/fitness-coach/SKILL.md',
      ),
    ).toEqual({
      ok: true,
      url: 'https://raw.githubusercontent.com/google-ai-edge/gallery/main/skills/fitness-coach/SKILL.md',
    });
  });

  it('validateSkillImportUrl rejects non-https schemes', () => {
    expect(parser.validateSkillImportUrl('http://example.com/SKILL.md')).toEqual({
      ok: false,
      error: 'Skill import URL must use HTTPS',
    });
    expect(parser.validateSkillImportUrl('file:///tmp/SKILL.md')).toEqual({
      ok: false,
      error: 'Skill import URL must use HTTPS',
    });
  });
});
