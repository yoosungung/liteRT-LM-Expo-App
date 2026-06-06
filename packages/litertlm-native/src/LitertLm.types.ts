export type Backend = 'cpu' | 'gpu' | 'npu';
export type EngineMode = 'live' | 'mock';

export interface StreamBatchConfig {
  flushIntervalMs?: number;
  maxTokensPerBatch?: number;
}

export interface MockEngineConfig {
  tokensPerSecond?: number;
  cannedResponses?: string[];
  simulateThinking?: boolean;
}

export interface EngineConfig {
  mode: EngineMode;
  modelPath?: string;
  backend?: Backend;
  cacheDir?: string;
  streamBatch?: StreamBatchConfig;
  mock?: MockEngineConfig;
}

export type InferenceLifecycle =
  | 'unloaded'
  | 'loading'
  | 'active'
  | 'idle'
  | 'hibernating'
  | 'hibernated'
  | 'restoring'
  | 'error';

export interface EngineStatus {
  lifecycle: InferenceLifecycle;
  modelId?: string;
  backend?: Backend;
  activeConversationId?: string;
  errorMessage?: string;
  lastTransitionAt?: number;
  kvSnapshotPresent?: boolean;
}

export interface HibernationPolicy {
  idleTimeoutMs?: number;
  hibernateOnMemoryWarning?: boolean;
  persistKvOnHibernate?: boolean;
}

export interface PersistResult {
  conversationId: string;
  snapshotPath: string;
  snapshotBytes: number;
  usedNativeKvSerialize: boolean;
}

export interface RestoreResult {
  conversationId: string;
  restoredFrom: 'kv_snapshot' | 'message_replay' | 'empty';
  prefillSkippedTokens?: number;
}

export interface SamplerConfig {
  temperature?: number;
  topK?: number;
  topP?: number;
}

export type ToolRiskLevel = 'read' | 'write' | 'destructive';

export interface ToolDefinition {
  name: string;
  description: string;
  parametersJsonSchema: object;
  riskLevel?: ToolRiskLevel;
  requiresApproval?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

export interface ConversationConfig {
  conversationId: string;
  systemInstruction?: string;
  sampler?: SamplerConfig;
  tools?: ToolDefinition[];
  automaticToolCalling?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  timestamp: number;
}

export type StreamDeltaKind = 'token' | 'thinking';

export interface StreamPart {
  kind: StreamDeltaKind;
  delta: string;
}

export interface StreamDeltaEvent {
  conversationId: string;
  delta: string;
  kind: StreamDeltaKind;
}

export interface InferenceLifecycleEvent {
  from: InferenceLifecycle;
  to: InferenceLifecycle;
  reason?: string;
}

export interface LitertLmError {
  code: string;
  message: string;
}

export interface ToolCallEvent {
  conversationId: string;
  toolCall: ToolCall;
}

export interface ToolApprovalRequiredEvent {
  conversationId: string;
  toolCall: ToolCall;
  riskLevel: ToolRiskLevel;
}

export interface RunJsRequiredEvent {
  conversationId: string;
  toolCallId: string;
  argumentsJson: string;
}

export type LitertLmEventMap = {
  onEngineStatusChanged: EngineStatus;
  onInferenceLifecycleChanged: InferenceLifecycleEvent;
  onStreamDelta: StreamDeltaEvent;
  onMessageComplete: { conversationId: string; message: Message };
  onToolCall: ToolCallEvent;
  onToolApprovalRequired: ToolApprovalRequiredEvent;
  onRunJsRequired: RunJsRequiredEvent;
  onError: LitertLmError;
};

export type LitertLmEventName = keyof LitertLmEventMap;

export type LitertLmEventListener<T extends LitertLmEventName> = (
  event: LitertLmEventMap[T],
) => void;
