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

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { ModelId } from '../models/manifest';
import { ModelManager } from '../models/ModelManager';
import { ModelPreferences } from '../models/ModelPreferences';
import { inferenceCacheDirectory } from '../models/verifyModel';
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

const MODEL_IDS: ModelId[] = ['gemma-4-e2b', 'gemma-4-e4b'];

function isIosSimulator(): boolean {
  return Platform.OS === 'ios' && Constants.isDevice === false;
}

function resolvePreferredBackend(preferred: Backend): Backend {
  if (isIosSimulator()) {
    return 'cpu';
  }
  return preferred;
}

export class AgentRuntime {
  readonly sessionStore = new SessionStore();
  readonly modelManager = new ModelManager();
  readonly modelPreferences = new ModelPreferences();
  readonly coordinator: InferenceCoordinator;

  private engine: LitertLmEngine;
  private promptEngine = createPromptTemplateEngine();
  private engineConfig: EngineConfig;
  private initialized = false;
  private modelLoaded = false;
  private loadedBackend: Backend | null = null;
  private activeModelId: ModelId = 'gemma-4-e2b';
  private abortControllers = new Map<string, AbortController>();
  private loadModelPromise: Promise<{ backend: Backend }> | null = null;
  private loadingModelId: ModelId | null = null;

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

  getActiveModelId(): ModelId {
    return this.activeModelId;
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
      cacheDir: inferenceCacheDirectory().uri,
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
    await this.engine.createConversation({
      conversationId: id,
      systemInstruction: this.promptEngine.buildSystemInstruction(session),
    });

    return session;
  }

  async ensureConversation(session: StoredSession): Promise<void> {
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

    await this.engine.createConversation({
      conversationId: session.id,
      systemInstruction: this.promptEngine.buildSystemInstruction(session),
    });
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
    const preferredBackend = resolvePreferredBackend(lastUsed?.backend ?? 'gpu');

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
