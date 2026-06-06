import type { AppStateStatus } from 'react-native';
import type { EngineConfig, LitertLmEngine } from 'litertlm-native';

export type AppLifecycleState = 'active' | 'background' | 'inactive';

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

  constructor(private readonly engine: LitertLmEngine) {}

  setLastEngineConfig(config: EngineConfig): void {
    this.lastEngineConfig = config;
  }

  async onAppStateChange(state: AppLifecycleState): Promise<void> {
    if (state === 'active') {
      this.clearIdleTimer();
      if (this.lastEngineConfig) {
        await this.engine.warmUp(this.lastEngineConfig);
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
    if (this.lastEngineConfig) {
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
