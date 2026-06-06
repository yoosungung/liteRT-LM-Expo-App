/**
 * Mock tool loop smoke — approval + submitToolResult without native module.
 * Run: pnpm litertlm-native mock-tool-smoke
 */
import { MockEngine } from '../src/mock/MockEngine';
import type { EngineConfig } from '../src/LitertLm.types';

const mockConfig: EngineConfig = {
  mode: 'mock',
  backend: 'cpu',
  streamBatch: { flushIntervalMs: 10, maxTokensPerBatch: 4 },
};

async function smokeReadTool(): Promise<void> {
  const engine = new MockEngine();
  const conversationId = 'tool-smoke-read';

  await engine.initialize(mockConfig);
  await engine.createConversation({
    conversationId,
    automaticToolCalling: true,
    tools: [],
  });

  let full = '';
  for await (const chunk of engine.sendMessage(conversationId, 'what time is it?')) {
    if (chunk.kind === 'token') {
      full += chunk.delta;
    }
  }

  await engine.shutdown();

  if (!full.includes('getCurrentTime')) {
    throw new Error(`read tool smoke: expected getCurrentTime in response, got: ${full}`);
  }
}

async function smokeApprovalTool(): Promise<void> {
  const engine = new MockEngine();
  const conversationId = 'tool-smoke-approval';
  let toolCallId: string | null = null;

  await engine.initialize(mockConfig);
  await engine.createConversation({
    conversationId,
    automaticToolCalling: true,
    tools: [],
  });

  const approvalSub = engine.addListener('onToolApprovalRequired', (event) => {
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

  await sleep(50);
  if (!toolCallId) {
    approvalSub.remove();
    await engine.shutdown();
    throw new Error('approval tool smoke: onToolApprovalRequired not emitted');
  }

  await engine.approveToolCall(conversationId, toolCallId, true);
  await engine.submitToolResult(
    conversationId,
    toolCallId,
    JSON.stringify({ opened: true, url: 'https://example.com' }),
  );

  const full = await streamPromise;
  approvalSub.remove();
  await engine.shutdown();

  if (!full.includes('openUrl')) {
    throw new Error(`approval tool smoke: expected openUrl in response, got: ${full}`);
  }
}

async function smokeManualTool(): Promise<void> {
  const engine = new MockEngine();
  const conversationId = 'tool-smoke-manual';
  let toolCallId: string | null = null;

  await engine.initialize(mockConfig);
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

  await sleep(50);
  if (!toolCallId) {
    await engine.shutdown();
    throw new Error('manual tool smoke: onToolCall not emitted');
  }

  await engine.submitToolResult(
    conversationId,
    toolCallId,
    JSON.stringify({ platform: 'test' }),
  );

  const full = await streamPromise;
  await engine.shutdown();

  if (!full.includes('getDeviceInfo')) {
    throw new Error(`manual tool smoke: expected getDeviceInfo in response, got: ${full}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  await smokeReadTool();
  await smokeApprovalTool();
  await smokeManualTool();
  console.log('mock-tool-smoke OK: read, approval, manual paths');
}

main().catch((error: unknown) => {
  console.error('mock-tool-smoke FAILED:', error);
  process.exit(1);
});
