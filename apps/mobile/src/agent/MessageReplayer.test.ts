import { describe, expect, it, vi } from 'vitest';
import type { LitertLmEngine, Message } from 'litertlm-native';

import { countReplayableUserTurns, replaySessionMessages } from './MessageReplayer';

describe('MessageReplayer', () => {
  it('countReplayableUserTurns skips empty user content', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'hello', timestamp: 1 },
      { id: '2', role: 'user', content: '   ', timestamp: 2 },
      { id: '3', role: 'assistant', content: 'hi', timestamp: 3 },
    ];
    expect(countReplayableUserTurns(messages)).toBe(1);
  });

  it('replaySessionMessages calls sendMessageSync per user turn', async () => {
    const sendMessageSync = vi.fn(async () => ({
      id: 'a1',
      role: 'assistant' as const,
      content: 'ok',
      timestamp: 1,
    }));
    const engine = { sendMessageSync } as unknown as LitertLmEngine;

    const messages: Message[] = [
      { id: '1', role: 'user', content: 'first', timestamp: 1 },
      { id: '2', role: 'assistant', content: 'r1', timestamp: 2 },
      { id: '3', role: 'user', content: 'second', timestamp: 3 },
    ];

    const replayed = await replaySessionMessages(engine, 'conv-1', messages);
    expect(replayed).toBe(2);
    expect(sendMessageSync).toHaveBeenCalledTimes(2);
    expect(sendMessageSync).toHaveBeenNthCalledWith(1, 'conv-1', 'first');
    expect(sendMessageSync).toHaveBeenNthCalledWith(2, 'conv-1', 'second');
  });

  it('replaySessionMessages returns 0 when no user turns', async () => {
    const engine = {
      sendMessageSync: vi.fn(),
    } as unknown as LitertLmEngine;
    const replayed = await replaySessionMessages(engine, 'conv-1', []);
    expect(replayed).toBe(0);
  });
});
