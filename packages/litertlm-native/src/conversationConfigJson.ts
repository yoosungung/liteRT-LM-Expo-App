import type { ConversationConfig } from './LitertLm.types';

export function serializeConversationConfig(config: ConversationConfig): string {
  return JSON.stringify({
    automaticToolCalling: config.automaticToolCalling !== false,
    enableBuiltinTools: (config.tools?.length ?? 0) > 0,
    sampler: config.sampler
      ? {
          temperature: config.sampler.temperature,
          topK: config.sampler.topK,
          topP: config.sampler.topP ?? 0.95,
        }
      : undefined,
  });
}
