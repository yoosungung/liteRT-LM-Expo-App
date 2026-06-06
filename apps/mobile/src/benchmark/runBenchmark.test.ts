import { describe, expect, it } from 'vitest';
import { MockEngine } from 'litertlm-native';

import { AgentRuntime } from '../agent/AgentRuntime';
import { BENCHMARK_PROMPT, formatBenchmarkModelLabel, runBenchmark } from './runBenchmark';

describe('runBenchmark', () => {
  it('formatBenchmarkModelLabel returns manifest display name', () => {
    expect(formatBenchmarkModelLabel('gemma-4-e2b')).toContain('E2B');
  });

  it('runBenchmark returns metrics in mock mode', async () => {
    const runtime = new AgentRuntime(new MockEngine());
    const metrics = await runBenchmark(runtime, 'gemma-4-e2b');

    expect(metrics.modelId).toBe('gemma-4-e2b');
    expect(metrics.engineMode).toBe('mock');
    expect(metrics.prompt).toBe(BENCHMARK_PROMPT);
    expect(metrics.placeholder).toBe(true);
    expect(metrics.totalMs).toBeGreaterThanOrEqual(0);
  });
});
