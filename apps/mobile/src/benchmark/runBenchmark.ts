import type { Backend, EngineMode } from 'litertlm-native';

import type { AgentRuntime } from '../agent/AgentRuntime';
import type { ModelId } from '../models/manifest';
import { getManifestEntry } from '../models/manifest';

export const BENCHMARK_PROMPT =
  'Reply with exactly one short sentence: The sky is blue.';

export interface BenchmarkMetrics {
  modelId: ModelId;
  engineMode: EngineMode;
  backend: Backend | null;
  prompt: string;
  ttftMs: number | null;
  totalMs: number;
  outputTokens: number;
  tokensPerSecond: number | null;
  placeholder: boolean;
}

export async function runBenchmark(
  runtime: AgentRuntime,
  modelId: ModelId,
): Promise<BenchmarkMetrics> {
  const engineMode = runtime.getEngineMode();
  const startedAt = Date.now();

  if (engineMode === 'mock') {
    await runtime.initialize();
    const session = await runtime.createSession({ modelId, title: 'Benchmark (mock)' });
    let outputTokens = 0;
    let ttftMs: number | null = null;

    for await (const chunk of runtime.sendUserMessage(session.id, BENCHMARK_PROMPT)) {
      if (chunk.type === 'token') {
        outputTokens += chunk.text.split(/\s+/).filter(Boolean).length;
        if (ttftMs == null) {
          ttftMs = Date.now() - startedAt;
        }
      }
    }

    const totalMs = Date.now() - startedAt;
    await runtime.sessionStore.deleteSession(session.id);

    return {
      modelId,
      engineMode,
      backend: runtime.getLoadedBackend(),
      prompt: BENCHMARK_PROMPT,
      ttftMs,
      totalMs,
      outputTokens,
      tokensPerSecond: outputTokens > 0 ? outputTokens / (totalMs / 1000) : null,
      placeholder: true,
    };
  }

  await runtime.ensureModelLoaded(modelId);
  const backend = runtime.getLoadedBackend();
  const session = await runtime.createSession({ modelId, title: 'Benchmark' });
  let outputChars = 0;
  let ttftMs: number | null = null;

  try {
    for await (const chunk of runtime.sendUserMessage(session.id, BENCHMARK_PROMPT)) {
      if (chunk.type === 'token') {
        outputChars += chunk.text.length;
        if (ttftMs == null) {
          ttftMs = Date.now() - startedAt;
        }
      } else if (chunk.type === 'error') {
        throw new Error(chunk.message);
      }
    }
  } finally {
    await runtime.sessionStore.deleteSession(session.id);
  }

  const totalMs = Date.now() - startedAt;
  const outputTokens = Math.max(1, Math.round(outputChars / 4));

  return {
    modelId,
    engineMode,
    backend,
    prompt: BENCHMARK_PROMPT,
    ttftMs,
    totalMs,
    outputTokens,
    tokensPerSecond: outputTokens / (totalMs / 1000),
    placeholder: false,
  };
}

export function formatBenchmarkModelLabel(modelId: ModelId): string {
  return getManifestEntry(modelId).displayName;
}
