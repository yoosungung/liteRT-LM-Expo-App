import type {
  ConversationConfig,
  EngineConfig,
  EngineStatus,
  HibernationPolicy,
  LitertLmEventListener,
  LitertLmEventMap,
  LitertLmEventName,
  Message,
  PersistResult,
  RestoreResult,
  StreamPart,
} from './LitertLm.types';

export interface LitertLmEngine {
  initialize(config: EngineConfig): Promise<void>;
  shutdown(): Promise<void>;
  getStatus(): EngineStatus;
  warmUp(config: EngineConfig): Promise<void>;
  enterIdle(): Promise<void>;
  hibernate(options?: { conversationIds?: string[] }): Promise<void>;
  setHibernationPolicy(policy: HibernationPolicy): void;
  persistSession(conversationId: string): Promise<PersistResult>;
  restoreSession(conversationId: string): Promise<RestoreResult>;
  deleteSessionSnapshot(conversationId: string): Promise<void>;
  createConversation(config: ConversationConfig): Promise<void>;
  closeConversation(conversationId: string): Promise<void>;
  sendMessage(
    conversationId: string,
    text: string,
    extraContext?: Record<string, unknown>,
  ): AsyncIterable<StreamPart>;
  sendMessageSync(
    conversationId: string,
    text: string,
    extraContext?: Record<string, unknown>,
  ): Promise<Message>;
  approveToolCall(conversationId: string, toolCallId: string, approved: boolean): Promise<void>;
  rejectToolCall(conversationId: string, toolCallId: string, reason?: string): Promise<void>;
  submitToolResult(conversationId: string, toolCallId: string, resultJson: string): Promise<void>;
  abortGeneration(conversationId: string): Promise<void>;
  addListener<T extends LitertLmEventName>(
    eventName: T,
    listener: LitertLmEventListener<T>,
  ): { remove: () => void };
}

export type { EngineConfig, EngineStatus, Message, StreamDeltaEvent } from './LitertLm.types';
