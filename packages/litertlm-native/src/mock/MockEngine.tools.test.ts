import { describe, expect, it } from 'vitest';

import { MockEngine } from './MockEngine';

const fastConfig = {
  mode: 'mock' as const,
  backend: 'cpu' as const,
  mock: { tokensPerSecond: 10_000 },
  streamBatch: { flushIntervalMs: 1, maxTokensPerBatch: 64 },
};

describe('MockEngine tool loop (mock-tool-smoke)', () => {
  it('read tool: auto-executes getCurrentTime', async () => {
    const engine = new MockEngine();
    const conversationId = 'tool-smoke-read';

    await engine.initialize(fastConfig);
    await engine.createConversation({ conversationId, automaticToolCalling: true, tools: [] });

    let full = '';
    for await (const chunk of engine.sendMessage(conversationId, 'what time is it?')) {
      if (chunk.kind === 'token') {
        full += chunk.delta;
      }
    }
    await engine.shutdown();

    expect(full).toContain('getCurrentTime');
  });

  it('approval tool: openUrl requires approval (§1.10)', async () => {
    const engine = new MockEngine();
    const conversationId = 'tool-smoke-approval';
    let toolCallId: string | null = null;

    await engine.initialize(fastConfig);
    await engine.createConversation({ conversationId, automaticToolCalling: true, tools: [] });

    engine.addListener('onToolApprovalRequired', (event) => {
      toolCallId = event.toolCall.id;
    });

    const streamPromise = (async () => {
      let full = '';
      for await (const chunk of engine.sendMessage(
        conversationId,
        'open https://example.com please',
      )) {
        if (chunk.kind === 'token') {
          full += chunk.delta;
        }
      }
      return full;
    })();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(toolCallId).not.toBeNull();

    await engine.approveToolCall(conversationId, toolCallId!, true);
    await engine.submitToolResult(
      conversationId,
      toolCallId!,
      JSON.stringify({ opened: true, url: 'https://example.com' }),
    );

    const full = await streamPromise;
    await engine.shutdown();

    expect(full).toContain('openUrl');
  });

  it('manual tool: emits onToolCall and waits for submitToolResult', async () => {
    const engine = new MockEngine();
    const conversationId = 'tool-smoke-manual';
    let toolCallId: string | null = null;

    await engine.initialize(fastConfig);
    await engine.createConversation({
      conversationId,
      automaticToolCalling: false,
      tools: [],
    });

    engine.addListener('onToolCall', (event) => {
      toolCallId = event.toolCall.id;
    });

    const streamPromise = (async () => {
      let full = '';
      for await (const chunk of engine.sendMessage(conversationId, 'device info')) {
        if (chunk.kind === 'token') {
          full += chunk.delta;
        }
      }
      return full;
    })();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(toolCallId).not.toBeNull();

    await engine.submitToolResult(
      conversationId,
      toolCallId!,
      JSON.stringify({ platform: 'test' }),
    );

    const full = await streamPromise;
    await engine.shutdown();

    expect(full).toContain('getDeviceInfo');
  });
});
