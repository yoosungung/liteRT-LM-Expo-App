import { describe, expect, it } from 'vitest';

import {
  detectSkillInvoke,
  formatActiveSkillBlock,
  formatSkillCatalog,
} from './skillCatalog';

describe('skillCatalog', () => {
  const refs = [
    { name: 'fitness-coach', description: 'Motivational workout routines.' },
    { name: 'wiki-helper', description: 'Concise bullet summaries.' },
  ];

  it('formatSkillCatalog lists name and description per Agent Skills progressive disclosure', () => {
    const catalog = formatSkillCatalog(refs);
    expect(catalog).toContain('## Agent Skills');
    expect(catalog).toContain('**fitness-coach**: Motivational workout routines.');
    expect(catalog).toContain('**wiki-helper**: Concise bullet summaries.');
    expect(catalog).toContain('/skill-name');
    expect(catalog).toContain('NOT tool names');
    expect(catalog).toContain('run_js');
  });

  it('formatSkillCatalog returns empty string when no skills', () => {
    expect(formatSkillCatalog([])).toBe('');
  });

  it('formatActiveSkillBlock embeds full instructions on invoke', () => {
    const block = formatActiveSkillBlock({
      name: 'fitness-coach',
      instructions: '# Coach\n\nBe upbeat.',
    });
    expect(block).toContain('## Active skill: fitness-coach');
    expect(block).toContain('# Coach');
    expect(block).toContain('Be upbeat.');
  });

  it('detectSkillInvoke parses /skill-name slash command', () => {
    expect(detectSkillInvoke('/fitness-coach give me a workout', ['fitness-coach'])).toEqual({
      skillName: 'fitness-coach',
      userText: 'give me a workout',
    });
  });

  it('detectSkillInvoke parses /skill:skill-name form', () => {
    expect(detectSkillInvoke('/skill:wiki-helper summarize AI', ['wiki-helper'])).toEqual({
      skillName: 'wiki-helper',
      userText: 'summarize AI',
    });
  });

  it('detectSkillInvoke returns null for unknown or disabled skills', () => {
    expect(detectSkillInvoke('/unknown hello', ['fitness-coach'])).toBeNull();
    expect(detectSkillInvoke('plain hello', ['fitness-coach'])).toBeNull();
  });

  it('detectSkillInvoke uses default prompt when slash command has no body', () => {
    expect(detectSkillInvoke('/fitness-coach', ['fitness-coach'])).toEqual({
      skillName: 'fitness-coach',
      userText: 'Help me using this skill.',
    });
  });
});
