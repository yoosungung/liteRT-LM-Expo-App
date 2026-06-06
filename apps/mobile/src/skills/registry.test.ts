import { describe, expect, it } from 'vitest';

import { createSkillParser } from './SkillParser';
import { SkillRegistry } from './registry';

const SAMPLE_SKILL = `---
name: wiki-helper
description: Summarizes topics using concise bullet points.
---

# Wiki Helper

Provide three bullet points with sources when possible.
`;

describe('SkillRegistry', () => {
  const parser = createSkillParser();

  it('registers parsed skill and lists SkillRef', () => {
    const registry = new SkillRegistry();
    const parsed = parser.parseSkillMarkdown(SAMPLE_SKILL, {
      source: { type: 'file', uri: 'file://wiki-helper/SKILL.md' },
    });
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;

    registry.register(parsed);
    expect(registry.listEnabledRefs()).toEqual([
      {
        name: 'wiki-helper',
        description: 'Summarizes topics using concise bullet points.',
      },
    ]);
  });

  it('rejects duplicate skill name', () => {
    const registry = new SkillRegistry();
    const parsed = parser.parseSkillMarkdown(SAMPLE_SKILL);
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;

    registry.register(parsed);
    expect(() => registry.register(parsed)).toThrow('Skill already registered: wiki-helper');
  });

  it('setEnabled toggles catalog visibility', () => {
    const registry = new SkillRegistry();
    const parsed = parser.parseSkillMarkdown(SAMPLE_SKILL);
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;

    registry.register(parsed);
    registry.setEnabled('wiki-helper', false);
    expect(registry.listEnabledRefs()).toEqual([]);

    registry.setEnabled('wiki-helper', true);
    expect(registry.listEnabledRefs()).toHaveLength(1);
  });

  it('unregister removes skill', () => {
    const registry = new SkillRegistry();
    const parsed = parser.parseSkillMarkdown(SAMPLE_SKILL);
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;

    registry.register(parsed);
    expect(registry.unregister('wiki-helper')).toBe(true);
    expect(registry.get('wiki-helper')).toBeUndefined();
    expect(registry.unregister('missing')).toBe(false);
  });

  it('hydrateInstalled replaces registry contents', () => {
    const registry = new SkillRegistry();
    const parsed = parser.parseSkillMarkdown(SAMPLE_SKILL);
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;

    registry.hydrateInstalled([
      {
        ...parsed,
        enabled: false,
        installedAt: 123,
      },
    ]);

    expect(registry.list()).toHaveLength(1);
    expect(registry.listEnabledRefs()).toEqual([]);
    expect(registry.get('wiki-helper')?.enabled).toBe(false);
  });
});
