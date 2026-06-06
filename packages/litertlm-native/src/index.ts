import type { EngineConfig, EngineMode } from './LitertLm.types';
import { MockEngine } from './mock/MockEngine';
import { NativeEngine } from './NativeEngine';
import type { LitertLmEngine } from './LitertLmModule';

declare const __DEV__: boolean | undefined;

function readEnvMode(): EngineMode | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const value = env?.EXPO_PUBLIC_LITERTLM_MODE;
  if (value === 'mock' || value === 'live') {
    return value;
  }
  return undefined;
}
export function resolveEngineMode(config?: Partial<EngineConfig>): EngineMode {
  if (config?.mode) {
    return config.mode;
  }
  const envMode = readEnvMode();
  if (envMode) {
    return envMode;
  }
  return typeof __DEV__ !== 'undefined' && __DEV__ ? 'mock' : 'live';
}

export function createEngine(config?: Partial<EngineConfig>): LitertLmEngine {
  const mode = resolveEngineMode(config);
  if (mode === 'mock') {
    return new MockEngine();
  }
  return new NativeEngine();
}

export function defaultMockConfig(): EngineConfig {
  return {
    mode: 'mock',
    backend: 'cpu',
    mock: {
      tokensPerSecond: 30,
      simulateThinking: false,
    },
    streamBatch: {
      flushIntervalMs: 50,
      maxTokensPerBatch: 8,
    },
  };
}

export * from './LitertLm.types';
export { serializeConversationConfig } from './conversationConfigJson';
export type { LitertLmEngine } from './LitertLmModule';
export { MockEngine } from './mock/MockEngine';
export { NativeEngine } from './NativeEngine';
export { TokenBatcher } from './mock/TokenBatcher';
export {
  isNativeSha256VerifyAvailable,
  verifyFileSha256Native,
  type Sha256VerifyResult,
} from './verifySha256';
