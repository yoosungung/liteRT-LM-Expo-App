import { describe, expect, it } from 'vitest';

import {
  fetchSkillMarkdown,
  importSkillFromUrl,
  resolveSkillImportUrl,
} from './skillImport';

const SAMPLE_SKILL = `---
name: wiki-helper
description: Summarizes topics using concise bullet points.
---

# Wiki Helper

Provide three bullet points.
`;

describe('skillImport', () => {
  it('resolveSkillImportUrl converts GitHub blob URLs to raw.githubusercontent.com', () => {
    expect(
      resolveSkillImportUrl(
        'https://github.com/google-ai-edge/gallery/blob/main/skills/fitness-coach/SKILL.md',
      ),
    ).toEqual({
      ok: true,
      url: 'https://raw.githubusercontent.com/google-ai-edge/gallery/main/skills/fitness-coach/SKILL.md',
    });
  });

  it('resolveSkillImportUrl accepts raw GitHub SKILL.md URLs', () => {
    expect(
      resolveSkillImportUrl(
        'https://raw.githubusercontent.com/google-ai-edge/gallery/main/skills/fitness-coach/SKILL.md',
      ),
    ).toEqual({
      ok: true,
      url: 'https://raw.githubusercontent.com/google-ai-edge/gallery/main/skills/fitness-coach/SKILL.md',
    });
  });

  it('resolveSkillImportUrl rejects non-https and non-SKILL.md paths', () => {
    expect(resolveSkillImportUrl('http://example.com/SKILL.md')).toEqual({
      ok: false,
      error: 'Skill import URL must use HTTPS',
    });
    expect(resolveSkillImportUrl('https://example.com/readme.md')).toEqual({
      ok: false,
      error: 'URL must point to a SKILL.md file',
    });
  });

  it('fetchSkillMarkdown validates fetched frontmatter', async () => {
    const result = await fetchSkillMarkdown('https://example.com/SKILL.md', async () => ({
      ok: true,
      text: '# not frontmatter',
    }));
    expect(result).toEqual({
      ok: false,
      error: 'Fetched content is not a valid SKILL.md (missing frontmatter)',
    });
  });

  it('importSkillFromUrl parses a valid remote SKILL.md', async () => {
    const result = await importSkillFromUrl('https://example.com/skills/wiki-helper/SKILL.md', async () => ({
      ok: true,
      text: SAMPLE_SKILL,
    }));

    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.frontmatter.name).toBe('wiki-helper');
    expect(result.source.type).toBe('url');
    expect(result.source.uri).toBe('https://example.com/skills/wiki-helper/SKILL.md');
  });
});
