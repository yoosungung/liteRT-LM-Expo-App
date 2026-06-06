import { describe, expect, it } from 'vitest';

import type { StreamChunk } from './StreamChunk';

function isTerminalChunk(chunk: StreamChunk): boolean {
  return chunk.type === 'done' || chunk.type === 'error';
}

describe('StreamChunk union', () => {
  it('distinguishes token and thinking chunks', () => {
    const token: StreamChunk = { type: 'token', text: 'hi' };
    const thinking: StreamChunk = { type: 'thinking', text: 'hmm' };
    expect(token.type).toBe('token');
    expect(thinking.type).toBe('thinking');
  });

  it('marks done and error as terminal', () => {
    expect(isTerminalChunk({ type: 'done' })).toBe(true);
    expect(isTerminalChunk({ type: 'error', message: 'fail' })).toBe(true);
    expect(isTerminalChunk({ type: 'token', text: 'x' })).toBe(false);
  });
});
