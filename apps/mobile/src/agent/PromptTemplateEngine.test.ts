import { describe, expect, it } from 'vitest';

import { createPromptTemplateEngine } from './PromptTemplateEngine';

describe('PromptTemplateEngine', () => {
  const engine = createPromptTemplateEngine();

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

  it('buildExtraContext sets enable_thinking when thinking is true', () => {
    expect(engine.buildExtraContext({ thinking: true })).toEqual({ enable_thinking: true });
    expect(engine.buildExtraContext({})).toEqual({});
  });

  it('toNativeUserTurn trims user text', () => {
    expect(engine.toNativeUserTurn('  hello  ', [])).toBe('hello');
  });
});
