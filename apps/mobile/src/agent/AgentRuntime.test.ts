import { describe, expect, it } from 'vitest';
import { MockEngine, type ConversationConfig } from 'litertlm-native';

import { AgentRuntime } from './AgentRuntime';

async function collectStream(runtime: AgentRuntime, sessionId: string, text: string) {
  const chunks = [];
  for await (const chunk of runtime.sendUserMessage(sessionId, text)) {
    chunks.push(chunk);
  }
  return chunks;
}

class ConfigCapturingMockEngine extends MockEngine {
  lastConversationConfig: ConversationConfig | null = null;

  async createConversation(config: ConversationConfig): Promise<void> {
    this.lastConversationConfig = config;
    return super.createConversation(config);
  }
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

  it('includes skill catalog in conversation systemInstruction when skills are registered', async () => {
    const engine = new ConfigCapturingMockEngine();
    const runtime = new AgentRuntime(engine);
    await runtime.ensureSkillsLoaded();

    const session = await runtime.createSession();
    await collectStream(runtime, session.id, '/fitness-coach I need a quick workout');

    expect(engine.lastConversationConfig?.systemInstruction).toContain('## Agent Skills');
    expect(engine.lastConversationConfig?.systemInstruction).toContain(
      '**fitness-coach**: A cheerful, high-energy fitness coach',
    );
    expect(engine.lastConversationConfig?.systemInstruction).toContain('## Active skill: fitness-coach');
    expect(engine.lastConversationConfig?.systemInstruction).toContain('upbeat fitness coach');

    const stored = await runtime.sessionStore.getSession(session.id);
    expect(stored?.messages.find((m) => m.role === 'user')?.content).toBe(
      'I need a quick workout',
    );
  });

  it('importSkillFromUrl registers a remote skill and persists it', async () => {
    const runtime = new AgentRuntime(new MockEngine());
    await runtime.ensureSkillsLoaded();

    const result = await runtime.importSkillFromUrl(
      'https://example.com/skills/wiki-helper/SKILL.md',
      async () => ({
        ok: true,
        text: `---
name: wiki-helper
description: Summarizes topics using concise bullet points.
---

# Wiki Helper
`,
      }),
    );
    expect('error' in result).toBe(false);
    expect(runtime.listSkills().some((s) => s.frontmatter.name === 'wiki-helper')).toBe(true);

    const reloaded = new AgentRuntime(new MockEngine());
    await reloaded.ensureSkillsLoaded();
    expect(reloaded.listSkills().some((s) => s.frontmatter.name === 'wiki-helper')).toBe(true);
  });

  it('executes bundled hash-demo JS skill via run_js in mock mode', async () => {
    const runtime = new AgentRuntime(new MockEngine());
    await runtime.ensureSkillsLoaded();

    const session = await runtime.createSession();
    const chunks = await collectStream(
      runtime,
      session.id,
      '/hash-demo reverse text hello',
    );

    const text = chunks
      .filter((c) => c.type === 'token')
      .map((c) => (c.type === 'token' ? c.text : ''))
      .join('');

    expect(text).toContain('hash-demo:olleh');
  });
});
