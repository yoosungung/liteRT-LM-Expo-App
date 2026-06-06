import type { InferenceLifecycle, ToolCall, ToolRiskLevel } from 'litertlm-native';

export type StreamChunk =
  | { type: 'token'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | {
      type: 'tool_approval_required';
      toolCall: ToolCall;
      riskLevel: ToolRiskLevel;
    }
  | { type: 'lifecycle'; lifecycle: InferenceLifecycle; message?: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
