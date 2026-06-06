import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TokenBatcher } from './TokenBatcher';

describe('TokenBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes when maxTokensPerBatch is reached (§1.7)', () => {
    const flushes: Array<{ delta: string; kind: string }> = [];
    const batcher = new TokenBatcher({
      maxTokensPerBatch: 3,
      flushIntervalMs: 10_000,
      onFlush: (delta, kind) => flushes.push({ delta, kind }),
    });

    batcher.append('a');
    batcher.append('b');
    expect(flushes).toHaveLength(0);
    batcher.append('c');
    expect(flushes).toEqual([{ delta: 'abc', kind: 'token' }]);
  });

  it('flushes on interval when batch is not full', () => {
    const flushes: string[] = [];
    const batcher = new TokenBatcher({
      maxTokensPerBatch: 8,
      flushIntervalMs: 50,
      onFlush: (delta) => flushes.push(delta),
    });

    batcher.append('hi');
    vi.advanceTimersByTime(49);
    expect(flushes).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(flushes).toEqual(['hi']);
  });

  it('flushes pending buffer when kind changes', () => {
    const flushes: Array<{ delta: string; kind: string }> = [];
    const batcher = new TokenBatcher({
      maxTokensPerBatch: 8,
      flushIntervalMs: 10_000,
      onFlush: (delta, kind) => flushes.push({ delta, kind }),
    });

    batcher.append('tok', 'token');
    batcher.append('think', 'thinking');
    batcher.flush();
    expect(flushes).toEqual([
      { delta: 'tok', kind: 'token' },
      { delta: 'think', kind: 'thinking' },
    ]);
  });

  it('flush() emits remaining buffer immediately', () => {
    const flushes: string[] = [];
    const batcher = new TokenBatcher({
      maxTokensPerBatch: 8,
      flushIntervalMs: 10_000,
      onFlush: (delta) => flushes.push(delta),
    });

    batcher.append('end');
    batcher.flush();
    expect(flushes).toEqual(['end']);
  });
});
