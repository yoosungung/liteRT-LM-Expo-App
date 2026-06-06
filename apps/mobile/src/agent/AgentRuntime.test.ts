import { describe, expect, it } from 'vitest';
import { MockEngine } from 'litertlm-native';

import { AgentRuntime } from './AgentRuntime';

async function collectStream(runtime: AgentRuntime, sessionId: string, text: string) {
  const chunks = [];
  for await (const chunk of runtime.sendUserMessage(sessionId, text)) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('AgentRuntime integration', () => {
  it('sendUserMessage completes mock 1-turn chat', async () => {
    const runtime = new AgentRuntime(new MockEngine());
    const session = await runtime.createSession({ title: 'Test' });
    const chunks = await collectStream(runtime, session.id, 'Hello');

    expect(chunks.some((c) => c.type === 'token')).toBe(true);
    expect(chunks.at(-1)?.type).toBe('done');

    const stored = await runtime.sessionStore.getSession(session.id);
    expect(stored?.messages.some((m) => m.role === 'user')).toBe(true);
    expect(stored?.messages.some((m) => m.role === 'assistant')).toBe(true);
  });

  it('tool approval flow approves openUrl in mock mode', async () => {
    const engine = new MockEngine();
    const runtime = new AgentRuntime(engine);
    const session = await runtime.createSession();

    let toolCallId: string | undefined;
    engine.addListener('onToolApprovalRequired', (event) => {
      toolCallId = event.toolCall.id;
    });

    const streamPromise = collectStream(
      runtime,
      session.id,
      'open https://example.com please',
    );

    await new Promise((resolve) => setTimeout(resolve, 30));
    if (toolCallId) {
      await runtime.respondToToolApproval(session.id, toolCallId, true);
    }

    const chunks = await streamPromise;
    const text = chunks
      .filter((c) => c.type === 'token')
      .map((c) => (c.type === 'token' ? c.text : ''))
      .join('');

    expect(text).toContain('openUrl');
  });

  it('abortGeneration stops in-flight stream', async () => {
    const runtime = new AgentRuntime(new MockEngine());
    const session = await runtime.createSession();

    const chunks: Array<{ type: string }> = [];
    const stream = runtime.sendUserMessage(session.id, 'Long response please');
    let started = false;
    const consume = (async () => {
      for await (const chunk of stream) {
        chunks.push(chunk);
        if (!started) {
          started = true;
          runtime.abortGeneration(session.id);
        }
      }
    })();

    await consume;
    expect(chunks.some((c) => c.type === 'error')).toBe(true);
  });

  it('respondToToolApproval deny produces denial response', async () => {
    const engine = new MockEngine();
    const runtime = new AgentRuntime(engine);
    const session = await runtime.createSession();

    let toolCallId: string | undefined;
    engine.addListener('onToolApprovalRequired', (event) => {
      toolCallId = event.toolCall.id;
    });

    const streamPromise = collectStream(
      runtime,
      session.id,
      'open https://example.com please',
    );

    await new Promise((resolve) => setTimeout(resolve, 30));
    if (toolCallId) {
      await runtime.respondToToolApproval(session.id, toolCallId, false);
    }

    const chunks = await streamPromise;
    const text = chunks
      .filter((c) => c.type === 'token')
      .map((c) => (c.type === 'token' ? c.text : ''))
      .join('');

    expect(text.toLowerCase()).toContain('denied');
  });
});
