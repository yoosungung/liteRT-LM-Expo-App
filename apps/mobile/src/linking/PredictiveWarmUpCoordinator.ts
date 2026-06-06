import type { AgentRuntime } from '../agent/AgentRuntime';
import type { ChatPreparePhase } from '../agent/InferenceCoordinator';
import type { StoredSession } from '../storage/SessionStore';
import type { DeepLinkRoute } from './deepLink';

export interface PredictiveWarmUpDeps {
  loadSession(sessionId: string): Promise<StoredSession | null>;
  prepareSession(
    session: StoredSession,
    onPhase?: (phase: ChatPreparePhase) => void,
  ): Promise<void>;
}

export class PredictiveWarmUpCoordinator {
  private warmedSessions = new Set<string>();

  constructor(private deps: PredictiveWarmUpDeps) {}

  static fromRuntime(runtime: AgentRuntime): PredictiveWarmUpCoordinator {
    return new PredictiveWarmUpCoordinator({
      loadSession: (sessionId) => runtime.sessionStore.getSession(sessionId),
      prepareSession: (session, onPhase) => runtime.prepareChatSession(session, onPhase),
    });
  }

  async handleRoute(route: DeepLinkRoute): Promise<boolean> {
    if (route.type === 'skill') {
      if (route.sessionId) {
        return this.warmSession(route.sessionId);
      }
      return false;
    }

    if (route.type === 'chat' || route.type === 'warmup') {
      return this.warmSession(route.sessionId);
    }

    return false;
  }

  async warmSession(sessionId: string): Promise<boolean> {
    if (this.warmedSessions.has(sessionId)) {
      return true;
    }

    const session = await this.deps.loadSession(sessionId);
    if (!session) {
      return false;
    }

    await this.deps.prepareSession(session);
    this.warmedSessions.add(sessionId);
    return true;
  }

  reset(): void {
    this.warmedSessions.clear();
  }
}
