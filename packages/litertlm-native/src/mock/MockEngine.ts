import type {
  ConversationConfig,
  EngineConfig,
  EngineStatus,
  HibernationPolicy,
  LitertLmEventListener,
  LitertLmEventMap,
  LitertLmEventName,
  Message,
  MockEngineConfig,
  PersistResult,
  RestoreResult,
  StreamDeltaKind,
  StreamPart,
  ToolCall,
} from '../LitertLm.types';
import type { LitertLmEngine } from '../LitertLmModule';
import {
  createToolCall,
  detectMockTool,
  mockReadToolResult,
  type MockToolTrigger,
} from './mockToolTriggers';
import { TokenBatcher } from './TokenBatcher';

interface PendingToolFlow {
  conversationId: string;
  toolCall: ToolCall;
  trigger: MockToolTrigger;
  resolveApproval?: (approved: boolean) => void;
  resolveResult?: (resultJson: string | null) => void;
}

const DEFAULT_CANNED = [
  'Hello! I am running in mock mode without a LiteRT-LM model file.',
  'Mock mode lets you build the chat UI and AgentRuntime before native Engine wiring.',
  'Token batching follows ARCHITECTURE §1.7 (~50ms or 8 tokens per flush).',
];

export class MockEngine implements LitertLmEngine {
  private status: EngineStatus = { lifecycle: 'unloaded' };
  private conversations = new Map<string, ConversationConfig>();
  private listeners = new Map<LitertLmEventName, Set<LitertLmEventListener<LitertLmEventName>>>();
  private config: EngineConfig | null = null;
  private hibernationPolicy: HibernationPolicy = {
    idleTimeoutMs: 300_000,
    hibernateOnMemoryWarning: true,
    persistKvOnHibernate: true,
  };
  private responseIndex = 0;
  private pendingTools = new Map<string, PendingToolFlow>();
  private abortedGenerations = new Set<string>();
  private snapshots = new Map<string, { messageCount: number }>();

  async initialize(config: EngineConfig): Promise<void> {
    await this.transition('loading');
    this.config = config;
    await this.transition('active', { backend: config.backend ?? 'cpu' });
  }

  async shutdown(): Promise<void> {
    this.conversations.clear();
    this.config = null;
    await this.transition('unloaded');
  }

  getStatus(): EngineStatus {
    return { ...this.status };
  }

  async warmUp(config: EngineConfig): Promise<void> {
    if (this.status.lifecycle === 'active' || this.status.lifecycle === 'idle') {
      return;
    }
    await this.initialize(config);
  }

  async enterIdle(): Promise<void> {
    if (this.status.lifecycle === 'active') {
      await this.transition('idle');
    }
  }

  async hibernate(options?: { conversationIds?: string[] }): Promise<void> {
    if (this.status.lifecycle === 'unloaded') {
      return;
    }
    await this.transition('hibernating');
    const ids =
      options?.conversationIds?.length
        ? options.conversationIds
        : Array.from(this.conversations.keys());
    if (this.hibernationPolicy.persistKvOnHibernate !== false) {
      for (const conversationId of ids) {
        const existing = this.snapshots.get(conversationId);
        this.snapshots.set(conversationId, {
          messageCount: existing?.messageCount ?? 0,
        });
      }
    }
    this.conversations.clear();
    this.config = null;
    await this.transition('hibernated', { kvSnapshotPresent: this.snapshots.size > 0 });
  }

  setHibernationPolicy(policy: HibernationPolicy): void {
    this.hibernationPolicy = { ...this.hibernationPolicy, ...policy };
  }

  async persistSession(
    conversationId: string,
    options?: { messageCount?: number },
  ): Promise<PersistResult> {
    const messageCount = options?.messageCount ?? this.snapshots.get(conversationId)?.messageCount ?? 0;
    this.snapshots.set(conversationId, { messageCount });
    return {
      conversationId,
      snapshotPath: `mock://${conversationId}.kvsnapshot`,
      snapshotBytes: 0,
      usedNativeKvSerialize: false,
    };
  }

  async restoreSession(conversationId: string): Promise<RestoreResult> {
    const snapshot = this.snapshots.get(conversationId);
    const restoredFrom =
      snapshot && snapshot.messageCount > 0
        ? ('message_replay' as const)
        : ('empty' as const);

    await this.transition('restoring');
    if (!this.conversations.has(conversationId) && this.status.lifecycle !== 'unloaded') {
      this.ensureActive();
    }
    await this.transition('active');

    return {
      conversationId,
      restoredFrom,
      prefillSkippedTokens: restoredFrom === 'message_replay' ? 0 : undefined,
    };
  }

  async deleteSessionSnapshot(conversationId: string): Promise<void> {
    this.snapshots.delete(conversationId);
  }

  async createConversation(config: ConversationConfig): Promise<void> {
    this.ensureActive();
    this.conversations.set(config.conversationId, config);
    this.patchStatus({ activeConversationId: config.conversationId });
  }

  async closeConversation(conversationId: string): Promise<void> {
    this.conversations.delete(conversationId);
    if (this.status.activeConversationId === conversationId) {
      this.patchStatus({ activeConversationId: undefined });
    }
  }

  async *sendMessage(
    conversationId: string,
    text: string,
    extraContext?: Record<string, unknown>,
  ): AsyncIterable<StreamPart> {
    this.ensureActive();
    try {
      const conversation = this.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

    const mock = this.config?.mock ?? {};
    const batchConfig = this.config?.streamBatch ?? {};
    const tokensPerSecond = mock.tokensPerSecond ?? 30;
    const automatic = conversation.automaticToolCalling !== false;
    const trigger = detectMockTool(text);

    const simulateThinking =
      extraContext?.enable_thinking === true || mock.simulateThinking === true;
    if (simulateThinking) {
      const thinking = 'Let me think about that for a moment…';
      for await (const chunk of this.streamWithBatcher(
        thinking,
        batchConfig,
        tokensPerSecond,
        'thinking',
        conversationId,
      )) {
        if (this.isGenerationAborted(conversationId)) {
          return;
        }
        yield { kind: 'thinking', delta: chunk };
      }
    }

    let toolResult: Record<string, unknown> | null = null;
    let toolDenied = false;

    if (trigger) {
      const toolCall = createToolCall(conversationId, trigger);

      if (!automatic) {
        this.emit('onToolCall', { conversationId, toolCall });
        const resultJson = await this.waitForToolResult(toolCall.id, conversationId, trigger, toolCall);
        if (resultJson === null) {
          toolDenied = true;
        } else {
          try {
            toolResult = JSON.parse(resultJson) as Record<string, unknown>;
          } catch {
            toolResult = { raw: resultJson };
          }
        }
      } else if (trigger.requiresApproval) {
        const approved = await this.waitForToolApproval(conversationId, toolCall, trigger);
        if (!approved) {
          toolDenied = true;
        } else {
          const resultJson = await this.waitForToolResult(toolCall.id, conversationId, trigger, toolCall);
          if (resultJson === null) {
            toolDenied = true;
          } else {
            try {
              toolResult = JSON.parse(resultJson) as Record<string, unknown>;
            } catch {
              toolResult = { raw: resultJson };
            }
          }
        }
      } else if (trigger.name === 'run_js') {
        this.emit('onToolCall', { conversationId, toolCall });
        const resultJson = await this.waitForToolResult(
          toolCall.id,
          conversationId,
          trigger,
          toolCall,
        );
        if (resultJson === null) {
          toolDenied = true;
        } else {
          try {
            toolResult = JSON.parse(resultJson) as Record<string, unknown>;
          } catch {
            toolResult = { raw: resultJson };
          }
        }
      } else {
        toolResult = mockReadToolResult(trigger.name);
      }
    }

    const response = toolDenied
      ? 'The tool call was denied by the user.'
      : toolResult
        ? this.formatToolResponse(text, toolResult, trigger!)
        : this.pickResponse(text, mock);

    let full = '';
    for await (const chunk of this.streamWithBatcher(response, batchConfig, tokensPerSecond, 'token', conversationId)) {
      if (this.isGenerationAborted(conversationId)) {
        return;
      }
      full += chunk;
      yield { kind: 'token', delta: chunk };
    }

    const message: Message = {
      id: `${conversationId}-${Date.now()}`,
      role: 'assistant',
      content: full,
      toolCalls: trigger ? [createToolCall(conversationId, trigger)] : undefined,
      timestamp: Date.now(),
    };
    this.emit('onMessageComplete', { conversationId, message });
    } finally {
      this.clearGenerationAbort(conversationId);
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
    const pending = this.pendingTools.get(toolCallId);
    if (!pending || pending.conversationId !== conversationId) {
      return;
    }
    pending.resolveApproval?.(approved);
    if (!approved) {
      pending.resolveResult?.(null);
      this.pendingTools.delete(toolCallId);
    }
  }

  async rejectToolCall(
    conversationId: string,
    toolCallId: string,
    reason?: string,
  ): Promise<void> {
    void reason;
    await this.approveToolCall(conversationId, toolCallId, false);
  }

  async submitToolResult(
    conversationId: string,
    toolCallId: string,
    resultJson: string,
  ): Promise<void> {
    const pending = this.pendingTools.get(toolCallId);
    if (!pending || pending.conversationId !== conversationId) {
      return;
    }
    pending.resolveResult?.(resultJson);
    this.pendingTools.delete(toolCallId);
  }

  async completeRunJs(_toolCallId: string, _resultJson: string): Promise<void> {
    // Live-only native bridge; mock uses onToolCall + submitToolResult.
  }

  async abortGeneration(conversationId: string): Promise<void> {
    this.abortedGenerations.add(conversationId);
  }

  addListener<T extends LitertLmEventName>(
    eventName: T,
    listener: LitertLmEventListener<T>,
  ): { remove: () => void } {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    const set = this.listeners.get(eventName)!;
    set.add(listener as LitertLmEventListener<LitertLmEventName>);
    return {
      remove: () => set.delete(listener as LitertLmEventListener<LitertLmEventName>),
    };
  }

  private async *streamWithBatcher(
    text: string,
    batchConfig: { flushIntervalMs?: number; maxTokensPerBatch?: number },
    tokensPerSecond: number,
    kind: StreamDeltaKind,
    conversationId: string,
  ): AsyncGenerator<string> {
    const pending: string[] = [];
    const batcher = new TokenBatcher({
      ...batchConfig,
      onFlush: (delta, flushKind) => {
        if (flushKind === kind) {
          pending.push(delta);
        }
      },
    });

    const words = text.split(/(\s+)/).filter((part) => part.length > 0);
    const delayMs = Math.max(1, Math.floor(1000 / Math.max(tokensPerSecond, 1)));

    for (const word of words) {
      if (this.isGenerationAborted(conversationId)) {
        return;
      }
      batcher.append(word, kind);
      await sleep(delayMs);
      while (pending.length > 0) {
        yield pending.shift()!;
      }
    }

    batcher.flush();
    while (pending.length > 0) {
      yield pending.shift()!;
    }
  }

  private waitForToolApproval(
    conversationId: string,
    toolCall: ToolCall,
    trigger: MockToolTrigger,
  ): Promise<boolean> {
    return new Promise((resolveApproval) => {
      this.pendingTools.set(toolCall.id, {
        conversationId,
        toolCall,
        trigger,
        resolveApproval,
      });
      this.emit('onToolApprovalRequired', {
        conversationId,
        toolCall,
        riskLevel: trigger.riskLevel,
      });
    });
  }

  private waitForToolResult(
    toolCallId: string,
    conversationId: string,
    trigger: MockToolTrigger,
    toolCall: ToolCall,
  ): Promise<string | null> {
    return new Promise((resolveResult) => {
      const existing = this.pendingTools.get(toolCallId);
      this.pendingTools.set(toolCallId, {
        conversationId,
        toolCall,
        trigger,
        resolveApproval: existing?.resolveApproval,
        resolveResult,
      });
    });
  }

  private formatToolResponse(
    text: string,
    result: Record<string, unknown>,
    trigger: MockToolTrigger,
  ): string {
    return `Tool \`${trigger.name}\` completed.\n\nResult: ${JSON.stringify(result, null, 2)}\n\n(You said: "${text.trim()}")`;
  }

  private pickResponse(text: string, mock: MockEngineConfig): string {
    const canned = mock.cannedResponses?.length ? mock.cannedResponses : DEFAULT_CANNED;
    const template = canned[this.responseIndex % canned.length]!;
    this.responseIndex += 1;
    return `${template}\n\n(You said: "${text.trim()}")`;
  }

  private isGenerationAborted(conversationId: string): boolean {
    return this.abortedGenerations.has(conversationId);
  }

  private clearGenerationAbort(conversationId: string): void {
    this.abortedGenerations.delete(conversationId);
  }

  private ensureActive(): void {
    if (this.status.lifecycle !== 'active' && this.status.lifecycle !== 'idle') {
      throw new Error('ENGINE_NOT_READY');
    }
  }

  private async transition(
    lifecycle: EngineStatus['lifecycle'],
    patch: Partial<EngineStatus> = {},
  ): Promise<void> {
    const from = this.status.lifecycle;
    this.status = {
      ...this.status,
      ...patch,
      lifecycle,
      lastTransitionAt: Date.now(),
    };
    this.emit('onEngineStatusChanged', this.getStatus());
    this.emit('onInferenceLifecycleChanged', { from, to: lifecycle });
    await sleep(lifecycle === 'loading' ? 120 : 0);
  }

  private patchStatus(patch: Partial<EngineStatus>): void {
    this.status = { ...this.status, ...patch, lastTransitionAt: Date.now() };
    this.emit('onEngineStatusChanged', this.getStatus());
  }

  private emit<T extends LitertLmEventName>(eventName: T, payload: LitertLmEventMap[T]): void {
    const set = this.listeners.get(eventName);
    if (!set) {
      return;
    }
    for (const listener of set) {
      listener(payload);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
