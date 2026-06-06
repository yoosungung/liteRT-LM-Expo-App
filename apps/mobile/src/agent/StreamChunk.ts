import type { InferenceLifecycle } from 'litertlm-native';

export type StreamChunk =
  | { type: 'token'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'lifecycle'; lifecycle: InferenceLifecycle; message?: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
