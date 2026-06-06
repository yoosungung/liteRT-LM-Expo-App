import type { Message } from 'litertlm-native';

export interface AgentSessionLike {
  id: string;
  systemInstruction?: string;
  messages: Message[];
}

export interface PromptTemplateEngine {
  buildSystemInstruction(session: AgentSessionLike): string;
  buildExtraContext(options: { thinking?: boolean }): Record<string, unknown>;
  toNativeUserTurn(text: string, history: Message[]): string;
}

export function createPromptTemplateEngine(): PromptTemplateEngine {
  const defaultSystem =
    'You are a helpful on-device assistant running entirely offline via LiteRT-LM.';

  return {
    buildSystemInstruction(session) {
      return session.systemInstruction?.trim() || defaultSystem;
    },

    buildExtraContext(options) {
      if (options.thinking) {
        return { enable_thinking: true };
      }
      return {};
    },

    toNativeUserTurn(text, _history) {
      return text.trim();
    },
  };
}
