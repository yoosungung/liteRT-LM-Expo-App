import { NativeModule, requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type {
  ConversationConfig,
  EngineConfig,
  EngineStatus,
  HibernationPolicy,
  InferenceLifecycle,
  InferenceLifecycleEvent,
  LitertLmError,
  LitertLmEventListener,
  LitertLmEventName,
  Message,
  PersistResult,
  RestoreResult,
  StreamDeltaEvent,
  StreamPart,
  ToolApprovalRequiredEvent,
  ToolCallEvent,
  RunJsRequiredEvent,
} from './LitertLm.types';
import { serializeConversationConfig } from './conversationConfigJson';
import type { LitertLmEngine } from './LitertLmModule';

type NativeLitertLmEvents = {
  onEngineStatusChanged: (status: EngineStatus) => void;
  onInferenceLifecycleChanged: (event: InferenceLifecycleEvent) => void;
  onStreamDelta: (event: StreamDeltaEvent) => void;
  onMessageComplete: (event: { conversationId: string; message: Message }) => void;
  onToolCall: (event: ToolCallEvent) => void;
  onToolApprovalRequired: (event: ToolApprovalRequiredEvent) => void;
  onRunJsRequired: (event: RunJsRequiredEvent) => void;
  onError: (event: LitertLmError) => void;
};

declare class ExpoLitertLmModule extends NativeModule<NativeLitertLmEvents> {
  initialize(modelPath: string, backend: string, cacheDir?: string | null): Promise<void>;
  warmUp(modelPath: string, backend: string, cacheDir?: string | null): Promise<void>;
  shutdown(): Promise<void>;
  getLifecycle(): string;
  createConversation(
    conversationId: string,
    systemInstruction?: string | null,
    configJson?: string | null,
  ): Promise<void>;
  approveToolCall(conversationId: string, toolCallId: string, approved: boolean): Promise<void>;
  rejectToolCall(conversationId: string, toolCallId: string, reason?: string | null): Promise<void>;
  completeRunJs(toolCallId: string, resultJson: string): Promise<void>;
  closeConversation(conversationId: string): Promise<void>;
  sendMessage(
    conversationId: string,
    text: string,
    extraContextJson?: string | null,
  ): Promise<void>;
  abortGeneration(conversationId: string): Promise<void>;
  enterIdle(): Promise<void>;
  hibernate(conversationIds?: string[] | null): Promise<void>;
  setHibernationPolicy(persistKvOnHibernate: boolean, hibernateOnMemoryWarning: boolean): void;
  persistSession(conversationId: string, messageCount?: number | null): Promise<PersistResult>;
  restoreSession(conversationId: string): Promise<RestoreResult>;
  deleteSessionSnapshot(conversationId: string): Promise<void>;
}

function loadNativeModule(): ExpoLitertLmModule {
  if (Platform.OS === 'web') {
    throw new Error('Live LiteRT-LM engine is not available on web. Use mock mode.');
  }
  return requireNativeModule<ExpoLitertLmModule>('LitertlmNative');
}

export class NativeEngine implements LitertLmEngine {
  private readonly native = loadNativeModule();
  private status: EngineStatus = { lifecycle: 'unloaded' };
  private config: EngineConfig | null = null;
  private hibernationPolicy: HibernationPolicy = {
    idleTimeoutMs: 300_000,
    hibernateOnMemoryWarning: true,
    persistKvOnHibernate: true,
  };

  async initialize(config: EngineConfig): Promise<void> {
    const modelPath = config.modelPath;
    if (!modelPath) {
      throw new Error('MODEL_NOT_FOUND: modelPath is required for live engine');
    }

    this.config = config;
    this.applyHibernationPolicyToNative();
    await this.native.initialize(modelPath, config.backend ?? 'cpu', config.cacheDir ?? null);
    this.patchStatus({
      lifecycle: (this.native.getLifecycle() as InferenceLifecycle) || 'active',
      backend: config.backend,
    });
  }

  async shutdown(): Promise<void> {
    await this.native.shutdown();
    this.config = null;
    this.patchStatus({ lifecycle: 'unloaded', activeConversationId: undefined });
  }

  getStatus(): EngineStatus {
    const lifecycle = this.native.getLifecycle() as InferenceLifecycle;
    return { ...this.status, lifecycle };
  }

  async warmUp(config: EngineConfig): Promise<void> {
    const lifecycle = this.native.getLifecycle();
    if (
      lifecycle === 'active' ||
      lifecycle === 'idle' ||
      lifecycle === 'loading' ||
      lifecycle === 'hibernating' ||
      lifecycle === 'restoring'
    ) {
      return;
    }

    const modelPath = config.modelPath ?? this.config?.modelPath;
    if (!modelPath) {
      throw new Error('MODEL_NOT_FOUND: modelPath is required for warmUp');
    }

    this.config = config;
    await this.native.warmUp(modelPath, config.backend ?? 'cpu', config.cacheDir ?? null);
    this.patchStatus({
      lifecycle: (this.native.getLifecycle() as InferenceLifecycle) || 'active',
      backend: config.backend,
    });
  }

  async enterIdle(): Promise<void> {
    await this.native.enterIdle();
    this.patchStatus({ lifecycle: 'idle' });
  }

  async hibernate(options?: { conversationIds?: string[] }): Promise<void> {
    await this.native.hibernate(options?.conversationIds ?? null);
    this.config = null;
    this.patchStatus({
      lifecycle: 'hibernated',
      activeConversationId: undefined,
      kvSnapshotPresent: true,
    });
  }

  setHibernationPolicy(policy: HibernationPolicy): void {
    this.hibernationPolicy = { ...this.hibernationPolicy, ...policy };
    this.applyHibernationPolicyToNative();
  }

  async persistSession(
    conversationId: string,
    options?: { messageCount?: number },
  ): Promise<PersistResult> {
    return this.native.persistSession(conversationId, options?.messageCount ?? null);
  }

  async restoreSession(conversationId: string): Promise<RestoreResult> {
    return this.native.restoreSession(conversationId);
  }

  async deleteSessionSnapshot(conversationId: string): Promise<void> {
    await this.native.deleteSessionSnapshot(conversationId);
  }

  private applyHibernationPolicyToNative(): void {
    this.native.setHibernationPolicy(
      this.hibernationPolicy.persistKvOnHibernate ?? true,
      this.hibernationPolicy.hibernateOnMemoryWarning ?? true,
    );
  }

  async createConversation(config: ConversationConfig): Promise<void> {
    await this.native.createConversation(
      config.conversationId,
      config.systemInstruction ?? null,
      serializeConversationConfig(config),
    );
    this.patchStatus({ activeConversationId: config.conversationId });
  }

  async closeConversation(conversationId: string): Promise<void> {
    await this.native.closeConversation(conversationId);
    if (this.status.activeConversationId === conversationId) {
      this.patchStatus({ activeConversationId: undefined });
    }
  }

  async *sendMessage(
    conversationId: string,
    text: string,
    extraContext?: Record<string, unknown>,
  ): AsyncIterable<StreamPart> {
    const queue: StreamPart[] = [];
    let pendingResolve: (() => void) | null = null;
    let done = false;
    let streamError: Error | null = null;

    const notify = () => {
      pendingResolve?.();
      pendingResolve = null;
    };

    const waitForChunk = () =>
      new Promise<void>((resolve) => {
        if (queue.length > 0 || done || streamError) {
          resolve();
          return;
        }
        pendingResolve = resolve;
      });

    const deltaSub = this.native.addListener('onStreamDelta', (event: StreamDeltaEvent) => {
        if (event.conversationId !== conversationId) {
          return;
        }
        queue.push({ kind: event.kind, delta: event.delta });
        notify();
      },
    );

    const completeSub = this.native.addListener(
      'onMessageComplete',
      (event: { conversationId: string; message: Message }) => {
        if (event.conversationId !== conversationId) {
          return;
        }
        done = true;
        notify();
      },
    );

    const errorSub = this.native.addListener('onError', (event: LitertLmError) => {
      if (event.code === 'GENERATION_ABORTED') {
        done = true;
        notify();
        return;
      }
      streamError = new Error(`${event.code}: ${event.message}`);
      done = true;
      notify();
    });

    try {
      await this.native.sendMessage(
        conversationId,
        text,
        extraContext ? JSON.stringify(extraContext) : null,
      );

      while (!done || queue.length > 0) {
        await waitForChunk();
        if (streamError) {
          throw streamError;
        }
        while (queue.length > 0) {
          yield queue.shift()!;
        }
      }
    } finally {
      deltaSub.remove();
      completeSub.remove();
      errorSub.remove();
    }
  }

  async sendMessageSync(
    conversationId: string,
    text: string,
    extraContext?: Record<string, unknown>,
  ): Promise<Message> {
    let content = '';
    for await (const chunk of this.sendMessage(conversationId, text, extraContext)) {
      if (chunk.kind === 'token') {
        content += chunk.delta;
      }
    }
    return {
      id: `${conversationId}-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
    };
  }

  async approveToolCall(
    conversationId: string,
    toolCallId: string,
    approved: boolean,
  ): Promise<void> {
    await this.native.approveToolCall(conversationId, toolCallId, approved);
  }

  async rejectToolCall(
    conversationId: string,
    toolCallId: string,
    reason?: string,
  ): Promise<void> {
    await this.native.rejectToolCall(conversationId, toolCallId, reason ?? null);
  }

  async submitToolResult(
    conversationId: string,
    toolCallId: string,
    resultJson: string,
  ): Promise<void> {
    void conversationId;
    void toolCallId;
    void resultJson;
    throw new Error('NOT_IMPLEMENTED: submitToolResult (live manual mode — Phase 2.2)');
  }

  async completeRunJs(toolCallId: string, resultJson: string): Promise<void> {
    await this.native.completeRunJs(toolCallId, resultJson);
  }

  async abortGeneration(conversationId: string): Promise<void> {
    await this.native.abortGeneration(conversationId);
  }

  addListener<T extends LitertLmEventName>(
    eventName: T,
    listener: LitertLmEventListener<T>,
  ): { remove: () => void } {
    const subscription = this.native.addListener(
      eventName,
      listener as NativeLitertLmEvents[typeof eventName],
    );
    return { remove: () => subscription.remove() };
  }

  private patchStatus(patch: Partial<EngineStatus>): void {
    this.status = { ...this.status, ...patch, lastTransitionAt: Date.now() };
  }
}
