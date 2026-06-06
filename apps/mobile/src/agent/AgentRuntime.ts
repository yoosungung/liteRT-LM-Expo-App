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
} from 'litertlm-native';

import type { ModelId } from '../models/manifest';
import { ModelManager } from '../models/ModelManager';
import { createSessionId, SessionStore, type StoredSession } from '../storage/SessionStore';
import { InferenceCoordinator } from './InferenceCoordinator';
import { createPromptTemplateEngine } from './PromptTemplateEngine';
import type { StreamChunk } from './StreamChunk';

export interface SessionOptions {
  modelId?: ModelId;
  systemInstruction?: string;
  title?: string;
}

function isEngineLifecycleReady(lifecycle: InferenceLifecycle): boolean {
  return lifecycle === 'active' || lifecycle === 'idle';
}

export class AgentRuntime {
  readonly sessionStore = new SessionStore();
  readonly modelManager = new ModelManager();
  readonly coordinator: InferenceCoordinator;

  private engine: LitertLmEngine;
  private promptEngine = createPromptTemplateEngine();
  private engineConfig: EngineConfig;
  private initialized = false;
  private modelLoaded = false;
  private loadedBackend: Backend | null = null;
  private activeModelId: ModelId = 'gemma-4-e2b';
  private abortControllers = new Map<string, AbortController>();

  constructor(engine?: LitertLmEngine) {
    this.engineConfig = defaultMockConfig();
    this.engine = engine ?? createEngine(this.engineConfig);
    this.coordinator = new InferenceCoordinator(this.engine);
    this.coordinator.setLastEngineConfig(this.engineConfig);
  }

  getEngineMode(): EngineMode {
    return resolveEngineMode(this.engineConfig);
  }

  getLoadedBackend(): Backend | null {
    return this.loadedBackend;
  }

  isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  getEngine(): LitertLmEngine {
    return this.engine;
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

    const backends: Backend[] =
      preferredBackend === 'gpu' ? ['gpu', 'cpu'] : [preferredBackend];

    let lastError: Error | null = null;
    for (const backend of backends) {
      try {
        await this.applyEngineConfig(mode, verifiedPath, backend);
        this.modelLoaded = true;
        this.loadedBackend = backend;
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
    };

    if (this.initialized) {
      await this.engine.shutdown();
      this.initialized = false;
    }

    this.engine = createEngine(this.engineConfig);
    this.coordinator.setEngine(this.engine);
    this.coordinator.setLastEngineConfig(this.engineConfig);
    await this.engine.initialize(this.engineConfig);
    this.initialized = true;
  }

  async createSession(options: SessionOptions = {}): Promise<StoredSession> {
    await this.initialize();

    const modelId = options.modelId ?? this.activeModelId;
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
    await this.engine.createConversation({
      conversationId: id,
      systemInstruction: this.promptEngine.buildSystemInstruction(session),
    });

    return session;
  }

  async ensureConversation(session: StoredSession): Promise<void> {
    const mode = resolveEngineMode();
    if (mode === 'live') {
      if (!this.modelLoaded || !this.engineConfig.modelPath) {
        throw new Error(
          'Models 탭에서 verified 모델을 Use for chat으로 먼저 로드하세요.',
        );
      }
    }

    await this.initialize();

    const lifecycle = this.engine.getStatus().lifecycle;
    if (mode === 'live' && !isEngineLifecycleReady(lifecycle)) {
      throw new Error(
        `Engine not ready (lifecycle=${lifecycle}). Models에서 다시 로드하세요. 에뮬레이터는 GPU 대신 CPU로 자동 전환됩니다.`,
      );
    }

    await this.engine.createConversation({
      conversationId: session.id,
      systemInstruction: this.promptEngine.buildSystemInstruction(session),
    });
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

    let assistantText = '';
    const nativeTurn = this.promptEngine.toNativeUserTurn(trimmed, session.messages);
    const extraContext = this.promptEngine.buildExtraContext({ thinking: false });

    try {
      for await (const chunk of this.engine.sendMessage(
        sessionId,
        nativeTurn,
        extraContext,
      )) {
        if (abort.signal.aborted) {
          yield { type: 'error', message: 'Generation aborted' };
          return;
        }
        assistantText += chunk;
        yield { type: 'token', text: chunk };
      }

      const assistantMessage: Message = {
        id: `${sessionId}-assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantText,
        timestamp: Date.now(),
      };
      await this.sessionStore.appendMessage(sessionId, assistantMessage);
      yield { type: 'done' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', message };
    } finally {
      this.abortControllers.delete(sessionId);
    }
  }

  abortGeneration(sessionId: string): void {
    this.abortControllers.get(sessionId)?.abort();
  }
}

let runtimeSingleton: AgentRuntime | null = null;

export function getAgentRuntime(): AgentRuntime {
  if (!runtimeSingleton) {
    runtimeSingleton = new AgentRuntime();
  }
  return runtimeSingleton;
}
