import { describe, expect, it } from 'vitest';

import { createPromptTemplateEngine } from './PromptTemplateEngine';

describe('PromptTemplateEngine', () => {
  const engine = createPromptTemplateEngine();
  const sampleSkills = [
    { name: 'fitness-coach', description: 'Motivational workout routines.' },
  ];

  it('uses custom systemInstruction when provided (§1.9)', () => {
    const instruction = engine.buildSystemInstruction({
      id: 's1',
      systemInstruction: '  Custom agent  ',
      messages: [],
    });
    expect(instruction).toBe('Custom agent');
  });

  it('falls back to default system instruction', () => {
    const instruction = engine.buildSystemInstruction({ id: 's1', messages: [] });
    expect(instruction).toContain('on-device assistant');
  });

  it('appends skill catalog when enabled skills are provided (§1.14)', () => {
    const instruction = engine.buildSystemInstruction(
      { id: 's1', messages: [] },
      { skills: sampleSkills },
    );
    expect(instruction).toContain('on-device assistant');
    expect(instruction).toContain('## Agent Skills');
    expect(instruction).toContain('**fitness-coach**: Motivational workout routines.');
  });

  it('merges active skill instructions on invoke without exposing catalog body twice', () => {
    const instruction = engine.buildSystemInstruction(
      { id: 's1', messages: [] },
      {
        skills: sampleSkills,
        activeSkill: {
          name: 'fitness-coach',
          instructions: '# Coach\n\nBe upbeat and energetic.',
        },
      },
    );
    expect(instruction).toContain('**fitness-coach**: Motivational workout routines.');
    expect(instruction).toContain('## Active skill: fitness-coach');
    expect(instruction).toContain('Be upbeat and energetic.');
  });

  it('omits skill catalog when skills array is empty', () => {
    const instruction = engine.buildSystemInstruction({ id: 's1', messages: [] }, { skills: [] });
    expect(instruction).not.toContain('## Agent Skills');
  });

  it('buildExtraContext sets enable_thinking when thinking is true', () => {
    expect(engine.buildExtraContext({ thinking: true })).toEqual({ enable_thinking: true });
    expect(engine.buildExtraContext({})).toEqual({});
  });

  it('toNativeUserTurn trims user text', () => {
    expect(engine.toNativeUserTurn('  hello  ', [])).toBe('hello');
  });
});
