import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from 'litertlm-native';

const STORAGE_KEY = '@litertlm/sessions';

export interface StoredSession {
  id: string;
  title: string;
  modelId: string;
  messages: Message[];
  systemInstruction?: string;
  createdAt: number;
  updatedAt: number;
}

export class SessionStore {
  async listSessions(): Promise<StoredSession[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const sessions = JSON.parse(raw) as StoredSession[];
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getSession(id: string): Promise<StoredSession | null> {
    const sessions = await this.listSessions();
    return sessions.find((s) => s.id === id) ?? null;
  }

  async saveSession(session: StoredSession): Promise<void> {
    const sessions = await this.listSessions();
    const index = sessions.findIndex((s) => s.id === session.id);
    const next = { ...session, updatedAt: Date.now() };
    if (index >= 0) {
      sessions[index] = next;
    } else {
      sessions.unshift(next);
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  async deleteSession(id: string): Promise<void> {
    const sessions = await this.listSessions();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(sessions.filter((s) => s.id !== id)),
    );
  }

  async appendMessage(sessionId: string, message: Message): Promise<StoredSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const updated: StoredSession = {
      ...session,
      messages: [...session.messages, message],
      title: session.title || deriveTitle(session.messages, message),
      updatedAt: Date.now(),
    };
    await this.saveSession(updated);
    return updated;
  }

  async replaceMessages(sessionId: string, messages: Message[]): Promise<StoredSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const updated: StoredSession = {
      ...session,
      messages,
      updatedAt: Date.now(),
    };
    await this.saveSession(updated);
    return updated;
  }
}

function deriveTitle(existing: Message[], latest: Message): string {
  const userMessage = latest.role === 'user' ? latest : existing.find((m) => m.role === 'user');
  const text = userMessage?.content.trim() ?? 'New chat';
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

export function createSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
