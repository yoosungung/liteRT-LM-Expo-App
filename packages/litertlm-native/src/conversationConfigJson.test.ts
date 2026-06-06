import { describe, expect, it } from 'vitest';

import { serializeConversationConfig } from './conversationConfigJson';

describe('serializeConversationConfig', () => {
  it('defaults automaticToolCalling to true', () => {
    const json = JSON.parse(serializeConversationConfig({ conversationId: 'c1' }));
    expect(json.automaticToolCalling).toBe(true);
  });

  it('respects automaticToolCalling false', () => {
    const json = JSON.parse(
      serializeConversationConfig({ conversationId: 'c1', automaticToolCalling: false }),
    );
    expect(json.automaticToolCalling).toBe(false);
  });

  it('enables builtin tools when tools array is non-empty', () => {
    const json = JSON.parse(
      serializeConversationConfig({
        conversationId: 'c1',
        tools: [{ name: 'getCurrentTime', description: 'time', parametersJsonSchema: {} }],
      }),
    );
    expect(json.enableBuiltinTools).toBe(true);
  });

  it('serializes sampler with default topP', () => {
    const json = JSON.parse(
      serializeConversationConfig({
        conversationId: 'c1',
        sampler: { temperature: 0.5, topK: 20 },
      }),
    );
    expect(json.sampler).toEqual({ temperature: 0.5, topK: 20, topP: 0.95 });
  });
});
