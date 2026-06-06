import type { AppStateStatus } from 'react-native';
import type { EngineConfig, InferenceLifecycle, LitertLmEngine } from 'litertlm-native';

export type AppLifecycleState = 'active' | 'background' | 'inactive';

function isEngineBusy(lifecycle: InferenceLifecycle): boolean {
  return lifecycle === 'loading' || lifecycle === 'hibernating' || lifecycle === 'restoring';
}

export function mapAppState(status: AppStateStatus): AppLifecycleState {
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

  constructor(private engine: LitertLmEngine) {}

  setEngine(engine: LitertLmEngine): void {
    this.engine = engine;
  }

  setLastEngineConfig(config: EngineConfig): void {
    this.lastEngineConfig = config;
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

  async onChatFocus(conversationId: string): Promise<void> {
    this.focusedConversationId = conversationId;
    this.clearIdleTimer();
    if (!this.lastEngineConfig?.modelPath) {
      return;
    }
    const lifecycle = this.engine.getStatus().lifecycle;
    if (isEngineBusy(lifecycle)) {
      return;
    }
    if (lifecycle !== 'active' && lifecycle !== 'idle') {
      await this.engine.warmUp(this.lastEngineConfig);
    }
    await this.engine.restoreSession(conversationId);
  }

  async onChatBlur(conversationId: string): Promise<void> {
    if (this.focusedConversationId === conversationId) {
      this.focusedConversationId = null;
    }
    await this.engine.persistSession(conversationId);
  }

  async requestHibernate(): Promise<void> {
    this.clearIdleTimer();
    const ids = this.focusedConversationId ? [this.focusedConversationId] : undefined;
    await this.engine.hibernate({ conversationIds: ids });
  }

  private scheduleHibernate(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      void this.engine.hibernate({
        conversationIds: this.focusedConversationId ? [this.focusedConversationId] : undefined,
      });
    }, 300_000);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
