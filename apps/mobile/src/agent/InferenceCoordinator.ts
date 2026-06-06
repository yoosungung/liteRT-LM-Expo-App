import type { EngineConfig, LitertLmEngine } from 'litertlm-native';

import type { StoredSession } from '../storage/SessionStore';
import { countReplayableUserTurns, replaySessionMessages } from './MessageReplayer';

export type AppLifecycleState = 'active' | 'background' | 'inactive';

export type ChatPreparePhase = 'loading' | 'restoring' | 'ready';

export interface InferenceCoordinatorOptions {
  idleTimeoutMs?: number;
  isGenerating?: () => boolean;
}

function isEngineBusy(lifecycle: string): boolean {
  return lifecycle === 'loading' || lifecycle === 'hibernating' || lifecycle === 'restoring';
}

export function resolveIdleTimeoutMs(policyMs?: number): number {
  if (policyMs && policyMs > 0) {
    return policyMs;
  }
  const env = process.env.EXPO_PUBLIC_HIBERNATE_TIMEOUT_MS;
  if (env) {
    const parsed = Number(env);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 300_000;
}

export function mapAppState(status: import('react-native').AppStateStatus): AppLifecycleState {
  if (status === 'active') {
    return 'active';
  }
  if (status === 'background') {
    return 'background';
  }
  return 'inactive';
}

export class InferenceCoordinator {
  private focusedConversationId: string | null = null;
  private lastEngineConfig: EngineConfig | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimeoutMs: number;
  private isGenerating: () => boolean;

  constructor(
    private engine: LitertLmEngine,
    options: InferenceCoordinatorOptions = {},
  ) {
    this.idleTimeoutMs = resolveIdleTimeoutMs(options.idleTimeoutMs);
    this.isGenerating = options.isGenerating ?? (() => false);
  }

  setEngine(engine: LitertLmEngine): void {
    this.engine = engine;
  }

  setLastEngineConfig(config: EngineConfig): void {
    this.lastEngineConfig = config;
  }

  setIdleTimeoutMs(ms: number): void {
    this.idleTimeoutMs = resolveIdleTimeoutMs(ms);
  }

  async onAppStateChange(state: AppLifecycleState): Promise<void> {
    if (state === 'active') {
      this.clearIdleTimer();
      if (this.lastEngineConfig?.modelPath) {
        const lifecycle = this.engine.getStatus().lifecycle;
        if (!isEngineBusy(lifecycle)) {
          await this.engine.warmUp(this.lastEngineConfig);
        }
      }
      return;
    }

    if (state === 'background') {
      await this.engine.enterIdle();
      this.scheduleHibernate();
    }
  }

  async onChatFocus(
    conversationId: string,
    session?: StoredSession,
    onPhase?: (phase: ChatPreparePhase) => void,
  ): Promise<void> {
    this.focusedConversationId = conversationId;
    this.clearIdleTimer();

    if (!this.lastEngineConfig?.modelPath && !session) {
      onPhase?.('ready');
      return;
    }

    const lifecycle = this.engine.getStatus().lifecycle;
    if (isEngineBusy(lifecycle)) {
      onPhase?.('ready');
      return;
    }

    onPhase?.('loading');

    if (this.lastEngineConfig?.modelPath) {
      if (lifecycle === 'hibernated' || lifecycle === 'unloaded') {
        await this.engine.warmUp(this.lastEngineConfig);
      } else if (lifecycle !== 'active' && lifecycle !== 'idle') {
        await this.engine.warmUp(this.lastEngineConfig);
      }
    }

    if (session) {
      const restore = await this.engine.restoreSession(conversationId);
      const replayableTurns = countReplayableUserTurns(session.messages);

      if (restore.restoredFrom === 'message_replay' && replayableTurns > 0) {
        onPhase?.('restoring');
        await replaySessionMessages(this.engine, conversationId, session.messages);
      }
    } else {
      await this.engine.restoreSession(conversationId);
    }

    onPhase?.('ready');
  }

  async onChatBlur(conversationId: string, messageCount = 0): Promise<void> {
    if (this.focusedConversationId === conversationId) {
      this.focusedConversationId = null;
    }
    await this.engine.persistSession(conversationId, { messageCount });
  }

  async requestHibernate(): Promise<void> {
    this.clearIdleTimer();
    await this.hibernateFocused();
  }

  private async hibernateFocused(): Promise<void> {
    const ids = this.focusedConversationId ? [this.focusedConversationId] : undefined;
    await this.engine.hibernate({ conversationIds: ids });
  }

  private scheduleHibernate(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (this.isGenerating()) {
        this.scheduleHibernate();
        return;
      }
      void this.hibernateFocused();
    }, this.idleTimeoutMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
