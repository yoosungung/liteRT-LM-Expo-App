import {
  createEngine,
  defaultMockConfig,
  resolveEngineMode,
  type Backend,
  type EngineConfig,
  type EngineMode,
  type InferenceLifecycle,
  type LitertLmEngine,
  type Message,
  type ToolCall,
  type ToolCallEvent,
  type ToolApprovalRequiredEvent,
  type ToolDefinition,
  type ToolRiskLevel,
} from 'litertlm-native';

import type { ModelId } from '../models/manifest';
import { meetsMinRamForModel, ramGateMessage } from '../models/deviceRam';
import { ModelManager } from '../models/ModelManager';
import { ModelPreferences } from '../models/ModelPreferences';
import { inferenceCachePath } from '../models/verifyModel';
import {
  defaultPreferredBackend,
  resolvePreferredBackend,
} from './deviceProfile';
import { createSessionId, SessionStore, type StoredSession } from '../storage/SessionStore';
import { AgentPreferences } from './AgentPreferences';
import {
  InferenceCoordinator,
  resolveIdleTimeoutMs,
  type AppLifecycleState,
  type ChatPreparePhase,
} from './InferenceCoordinator';
import { createPromptTemplateEngine } from './PromptTemplateEngine';
import type { StreamChunk } from './StreamChunk';
import { ToolRegistry } from './tools/registry';
import type { JsToolHandler, ToolPolicy } from './tools/types';

export interface SessionOptions {
  modelId?: ModelId;
  systemInstruction?: string;
  title?: string;
}

interface ApprovalGate {
  sessionId: string;
  toolCall: ToolCall;
  riskLevel: ToolRiskLevel;
  mode: 'automatic' | 'manual';
  resolve: (approved: boolean) => void;
}

function isEngineLifecycleReady(lifecycle: InferenceLifecycle): boolean {
  return lifecycle === 'active' || lifecycle === 'idle';
}

const MODEL_IDS: ModelId[] = ['gemma-4-e2b', 'gemma-4-e4b'];

export class AgentRuntime {
  readonly sessionStore = new SessionStore();
  readonly modelManager = new ModelManager();
  readonly modelPreferences = new ModelPreferences();
  readonly agentPreferences = new AgentPreferences();
  readonly toolRegistry = new ToolRegistry();
  readonly coordinator: InferenceCoordinator;

  private engine: LitertLmEngine;
  private promptEngine = createPromptTemplateEngine();
  private engineConfig: EngineConfig;
  private initialized = false;
  private modelLoaded = false;
  private loadedBackend: Backend | null = null;
  private activeModelId: ModelId = 'gemma-4-e2b';
  private abortControllers = new Map<string, AbortController>();
  private generatingSessions = new Set<string>();
  private loadModelPromise: Promise<{ backend: Backend }> | null = null;
  private loadingModelId: ModelId | null = null;
  private ensureConversationInflight = new Map<string, Promise<void>>();
  private approvalGates = new Map<string, ApprovalGate>();
  private streamChunkQueue: StreamChunk[] = [];
  private wakeStream: (() => void) | null = null;

  constructor(engine?: LitertLmEngine) {
    this.engineConfig = defaultMockConfig();
    this.engine = engine ?? createEngine(this.engineConfig);
    this.coordinator = new InferenceCoordinator(this.engine, {
      isGenerating: () => this.generatingSessions.size > 0,
    });
    this.coordinator.setLastEngineConfig(this.engineConfig);
    this.applyHibernationPolicy();
  }

  getEngineMode(): EngineMode {
    return resolveEngineMode(this.engineConfig);
  }

  getLoadedBackend(): Backend | null {
    return this.loadedBackend;
  }

  getActiveModelId(): ModelId {
    return this.activeModelId;
  }

  isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  isGenerating(sessionId?: string): boolean {
    if (sessionId) {
      return this.generatingSessions.has(sessionId);
    }
    return this.generatingSessions.size > 0;
  }

  getEngine(): LitertLmEngine {
    return this.engine;
  }

  registerTool(
    handler: JsToolHandler,
    definition: ToolDefinition,
    policy?: ToolPolicy,
  ): void {
    this.toolRegistry.register(handler, definition, policy);
  }

  async respondToToolApproval(
    sessionId: string,
    toolCallId: string,
    approved: boolean,
    reason?: string,
  ): Promise<void> {
    const gate = this.approvalGates.get(toolCallId);
    if (!gate || gate.sessionId !== sessionId) {
      return;
    }

    if (gate.mode === 'manual') {
      gate.resolve(approved);
      this.approvalGates.delete(toolCallId);
      return;
    }

    if (!approved) {
      await this.engine.rejectToolCall(sessionId, toolCallId, reason ?? 'User denied');
      gate.resolve(false);
      this.approvalGates.delete(toolCallId);
      return;
    }

    await this.engine.approveToolCall(sessionId, toolCallId, true);
    if (resolveEngineMode() === 'mock') {
      await this.executeAndSubmitToolResult(sessionId, gate.toolCall);
    }
    gate.resolve(true);
    this.approvalGates.delete(toolCallId);
  }

  async onAppStateChange(state: AppLifecycleState): Promise<void> {
    if (state === 'background') {
      for (const sessionId of this.generatingSessions) {
        this.abortGeneration(sessionId);
      }
    }
    await this.coordinator.onAppStateChange(state);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.engine.initialize(this.engineConfig);
    this.initialized = true;
  }

  async loadModel(
    modelId: ModelId,
    preferredBackend: Backend = 'cpu',
  ): Promise<{ backend: Backend }> {
    this.activeModelId = modelId;
    const verifiedPath = await this.modelManager.getVerifiedModelPath(modelId);
    const mode = resolveEngineMode();

    if (mode === 'live' && !verifiedPath) {
      throw new Error('Model is not verified. Download and verify before live mode.');
    }

    if (mode === 'live' && !meetsMinRamForModel(modelId)) {
      throw new Error(ramGateMessage(modelId) ?? `Insufficient RAM for ${modelId}`);
    }

    const resolvedPreferred = resolvePreferredBackend(preferredBackend);
    const backends: Backend[] =
      resolvedPreferred === 'gpu' ? ['gpu', 'cpu'] : [resolvedPreferred];

    let lastError: Error | null = null;
    for (const backend of backends) {
      try {
        await this.applyEngineConfig(mode, verifiedPath, backend);
        this.modelLoaded = true;
        this.loadedBackend = backend;
        await this.modelPreferences.setLastUsed(modelId, backend);
        return { backend };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.modelLoaded = false;
        this.loadedBackend = null;
        this.initialized = false;
      }
    }

    throw lastError ?? new Error('Failed to load model');
  }

  private async applyEngineConfig(
    mode: EngineMode,
    modelPath: string | null,
    backend: Backend,
  ): Promise<void> {
    this.engineConfig = {
      ...defaultMockConfig(),
      mode,
      backend,
      modelPath: modelPath ?? undefined,
      cacheDir: inferenceCachePath(),
    };

    if (this.initialized) {
      await this.engine.shutdown();
      this.initialized = false;
    }

    this.engine = createEngine(this.engineConfig);
    this.coordinator.setEngine(this.engine);
    this.coordinator.setLastEngineConfig(this.engineConfig);
    this.applyHibernationPolicy();
    await this.engine.initialize(this.engineConfig);
    this.initialized = true;
  }

  private async buildConversationConfig(session: StoredSession) {
    const automaticToolCalling = await this.agentPreferences.getAutomaticToolCalling();
    const sampler = await this.agentPreferences.getSampler();
    return {
      conversationId: session.id,
      systemInstruction: this.promptEngine.buildSystemInstruction(session),
      tools: this.toolRegistry.listDefinitions(),
      automaticToolCalling,
      sampler,
    };
  }

  async createSession(options: SessionOptions = {}): Promise<StoredSession> {
    const modelId =
      options.modelId ??
      (await this.modelPreferences.getLastUsedModelId()) ??
      (await this.resolveDefaultModelId());

    await this.initialize();

    const id = createSessionId();
    const session: StoredSession = {
      id,
      title: options.title ?? 'New chat',
      modelId,
      messages: [],
      systemInstruction: options.systemInstruction,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.sessionStore.saveSession(session);
    await this.engine.createConversation(await this.buildConversationConfig(session));

    return session;
  }

  async prepareChatSession(
    session: StoredSession,
    onPhase?: (phase: ChatPreparePhase) => void,
  ): Promise<void> {
    onPhase?.('loading');
    const mode = resolveEngineMode();
    if (mode === 'live') {
      await this.ensureModelLoaded(session.modelId as ModelId);
    }
    await this.initialize();

    const lifecycle = this.engine.getStatus().lifecycle;
    if (
      this.engineConfig.modelPath &&
      (lifecycle === 'hibernated' || lifecycle === 'unloaded')
    ) {
      await this.engine.warmUp(this.engineConfig);
    }

    await this.ensureConversation(session);
    await this.coordinator.onChatFocus(session.id, session, onPhase);
  }

  private applyHibernationPolicy(): void {
    this.engine.setHibernationPolicy({
      idleTimeoutMs: resolveIdleTimeoutMs(),
      hibernateOnMemoryWarning: true,
      persistKvOnHibernate: true,
    });
    this.coordinator.setIdleTimeoutMs(resolveIdleTimeoutMs());
  }

  async ensureConversation(session: StoredSession): Promise<void> {
    const inflight = this.ensureConversationInflight.get(session.id);
    if (inflight) {
      return inflight;
    }

    const promise = this.runEnsureConversation(session);
    this.ensureConversationInflight.set(session.id, promise);
    try {
      await promise;
    } finally {
      this.ensureConversationInflight.delete(session.id);
    }
  }

  private async runEnsureConversation(session: StoredSession): Promise<void> {
    const mode = resolveEngineMode();
    if (mode === 'live') {
      await this.ensureModelLoaded(session.modelId as ModelId);
    }

    await this.initialize();

    const lifecycle = this.engine.getStatus().lifecycle;
    if (mode === 'live' && !isEngineLifecycleReady(lifecycle)) {
      throw new Error(
        `Engine not ready (lifecycle=${lifecycle}). Models에서 다시 로드하세요. 에뮬레이터는 GPU 대신 CPU로 자동 전환됩니다.`,
      );
    }

    await this.engine.createConversation(await this.buildConversationConfig(session));
  }

  async ensureModelLoaded(modelId: ModelId): Promise<void> {
    if (resolveEngineMode() === 'mock') {
      return;
    }

    if (
      this.modelLoaded &&
      this.activeModelId === modelId &&
      this.engineConfig.modelPath &&
      isEngineLifecycleReady(this.engine.getStatus().lifecycle)
    ) {
      return;
    }

    if (this.loadModelPromise) {
      await this.loadModelPromise;
      if (
        this.modelLoaded &&
        this.activeModelId === modelId &&
        this.engineConfig.modelPath &&
        isEngineLifecycleReady(this.engine.getStatus().lifecycle)
      ) {
        return;
      }
    }

    const resolvedId = await this.resolveLoadableModelId(modelId);
    if (!resolvedId) {
      throw new Error('verified 모델이 없습니다. Models 탭에서 E2B를 다운로드하세요.');
    }

    const lastUsed = await this.modelPreferences.getLastUsed();
    const preferredBackend = resolvePreferredBackend(
      lastUsed?.backend ?? defaultPreferredBackend(),
    );

    this.loadingModelId = resolvedId;
    this.loadModelPromise = this.loadModel(resolvedId, preferredBackend);
    try {
      await this.loadModelPromise;
    } finally {
      this.loadModelPromise = null;
      this.loadingModelId = null;
    }
  }

  private async resolveLoadableModelId(preferred: ModelId): Promise<ModelId | null> {
    if (await this.modelManager.getVerifiedModelPath(preferred)) {
      return preferred;
    }

    const lastUsed = await this.modelPreferences.getLastUsedModelId();
    if (lastUsed && (await this.modelManager.getVerifiedModelPath(lastUsed))) {
      return lastUsed;
    }

    for (const id of MODEL_IDS) {
      if (await this.modelManager.getVerifiedModelPath(id)) {
        return id;
      }
    }
    return null;
  }

  private async resolveDefaultModelId(): Promise<ModelId> {
    const resolved = await this.resolveLoadableModelId('gemma-4-e2b');
    return resolved ?? 'gemma-4-e2b';
  }

  async *sendUserMessage(sessionId: string, text: string): AsyncIterable<StreamChunk> {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    await this.initialize();
    const session = await this.sessionStore.getSession(sessionId);
    if (!session) {
      yield { type: 'error', message: 'Session not found' };
      return;
    }

    await this.ensureConversation(session);

    const userMessage: Message = {
      id: `${sessionId}-user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    await this.sessionStore.appendMessage(sessionId, userMessage);

    const abort = new AbortController();
    this.abortControllers.set(sessionId, abort);
    this.generatingSessions.add(sessionId);

    let assistantText = '';
    let assistantThinking = '';
    const nativeTurn = this.promptEngine.toNativeUserTurn(trimmed, session.messages);
    const thinkingEnabled = await this.agentPreferences.getThinkingEnabled();
    const extraContext = this.promptEngine.buildExtraContext({ thinking: thinkingEnabled });

    this.streamChunkQueue = [];
    const streamState = { done: false, error: null as Error | null };

    const pushChunk = (chunk: StreamChunk) => {
      this.streamChunkQueue.push(chunk);
      this.wakeStream?.();
    };

    const waitForChunk = () =>
      new Promise<void>((resolve) => {
        if (this.streamChunkQueue.length > 0 || streamState.done || streamState.error) {
          resolve();
          return;
        }
        this.wakeStream = resolve;
      });

    const approvalSub = this.engine.addListener(
      'onToolApprovalRequired',
      (event: ToolApprovalRequiredEvent) => {
        if (event.conversationId !== sessionId) {
          return;
        }
        this.registerApprovalGate(sessionId, event.toolCall, event.riskLevel, 'automatic');
        pushChunk({
          type: 'tool_approval_required',
          toolCall: event.toolCall,
          riskLevel: event.riskLevel,
        });
      },
    );

    const toolSub = this.engine.addListener('onToolCall', (event: ToolCallEvent) => {
      if (event.conversationId !== sessionId) {
        return;
      }
      pushChunk({ type: 'tool_call', toolCall: event.toolCall });
      void this.handleManualToolCall(sessionId, event.toolCall, pushChunk);
    });

    const streamTask = (async () => {
      try {
        for await (const chunk of this.engine.sendMessage(
          sessionId,
          nativeTurn,
          extraContext,
        )) {
          if (abort.signal.aborted) {
            streamState.error = new Error('Generation aborted');
            break;
          }
          if (chunk.kind === 'thinking') {
            pushChunk({ type: 'thinking', text: chunk.delta });
          } else {
            pushChunk({ type: 'token', text: chunk.delta });
          }
        }
      } catch (error) {
        streamState.error = error instanceof Error ? error : new Error(String(error));
      } finally {
        streamState.done = true;
        this.wakeStream?.();
      }
    })();

    try {
      while (!streamState.done || this.streamChunkQueue.length > 0) {
        await waitForChunk();
        if (streamState.error) {
          yield { type: 'error', message: streamState.error.message };
          return;
        }
        while (this.streamChunkQueue.length > 0) {
          const chunk = this.streamChunkQueue.shift()!;
          if (chunk.type === 'token') {
            assistantText += chunk.text;
          } else if (chunk.type === 'thinking') {
            assistantThinking += chunk.text;
          }
          yield chunk;
        }
      }

      await streamTask;

      if (abort.signal.aborted) {
        yield { type: 'error', message: 'Generation aborted' };
        return;
      }

      const assistantMessage: Message = {
        id: `${sessionId}-assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantText,
        thinking: assistantThinking.trim() ? assistantThinking : undefined,
        timestamp: Date.now(),
      };
      await this.sessionStore.appendMessage(sessionId, assistantMessage);
      yield { type: 'done' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', message };
    } finally {
      approvalSub.remove();
      toolSub.remove();
      this.streamChunkQueue = [];
      this.wakeStream = null;
      this.abortControllers.delete(sessionId);
      this.generatingSessions.delete(sessionId);
    }
  }

  private registerApprovalGate(
    sessionId: string,
    toolCall: ToolCall,
    riskLevel: ToolRiskLevel,
    mode: ApprovalGate['mode'],
  ): void {
    if (this.approvalGates.has(toolCall.id)) {
      return;
    }
    this.approvalGates.set(toolCall.id, {
      sessionId,
      toolCall,
      riskLevel,
      mode,
      resolve: () => {},
    });
  }

  private async handleManualToolCall(
    sessionId: string,
    toolCall: ToolCall,
    pushChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    const registered = this.toolRegistry.get(toolCall.name);
    if (!registered) {
      await this.engine.rejectToolCall(sessionId, toolCall.id, 'Unknown tool');
      return;
    }

    if (registered.policy.requiresApproval) {
      const approved = await new Promise<boolean>((resolve) => {
        this.approvalGates.set(toolCall.id, {
          sessionId,
          toolCall,
          riskLevel: registered.policy.riskLevel ?? 'write',
          mode: 'manual',
          resolve,
        });
        pushChunk({
          type: 'tool_approval_required',
          toolCall,
          riskLevel: registered.policy.riskLevel ?? 'write',
        });
      });
      if (!approved) {
        await this.engine.rejectToolCall(sessionId, toolCall.id, 'User denied');
        return;
      }
    }

    await this.executeAndSubmitToolResult(sessionId, toolCall);
  }

  private async executeAndSubmitToolResult(sessionId: string, toolCall: ToolCall): Promise<void> {
    const registered = this.toolRegistry.get(toolCall.name);
    if (!registered) {
      await this.engine.rejectToolCall(sessionId, toolCall.id, 'Unknown tool');
      return;
    }

    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(toolCall.argumentsJson) as Record<string, unknown>;
    } catch {
      await this.engine.rejectToolCall(sessionId, toolCall.id, 'Invalid tool arguments');
      return;
    }

    const result = await this.toolRegistry.execute(toolCall.name, args);
    await this.engine.submitToolResult(sessionId, toolCall.id, JSON.stringify(result));
  }

  abortGeneration(sessionId: string): void {
    this.abortControllers.get(sessionId)?.abort();
    void this.engine.abortGeneration(sessionId);
  }
}

let runtimeSingleton: AgentRuntime | null = null;

export function getAgentRuntime(): AgentRuntime {
  if (!runtimeSingleton) {
    runtimeSingleton = new AgentRuntime();
  }
  return runtimeSingleton;
}
