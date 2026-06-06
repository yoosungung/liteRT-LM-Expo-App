import type { Message } from 'litertlm-native';

import { formatActiveSkillBlock, formatSkillCatalog } from '../skills/skillCatalog';
import type { SkillRef } from '../skills/types';

export interface AgentSessionLike {
  id: string;
  systemInstruction?: string;
  messages: Message[];
}

export interface ActiveSkillContext {
  name: string;
  instructions: string;
}

export interface BuildSystemInstructionOptions {
  skills?: SkillRef[];
  activeSkill?: ActiveSkillContext;
}

export interface PromptTemplateEngine {
  buildSystemInstruction(
    session: AgentSessionLike,
    options?: BuildSystemInstructionOptions,
  ): string;
  buildExtraContext(options: { thinking?: boolean }): Record<string, unknown>;
  toNativeUserTurn(text: string, history: Message[]): string;
}

export function createPromptTemplateEngine(): PromptTemplateEngine {
  const defaultSystem =
    'You are a helpful on-device assistant running entirely offline via LiteRT-LM.';

  return {
    buildSystemInstruction(session, options) {
      const parts: string[] = [session.systemInstruction?.trim() || defaultSystem];

      const catalog = formatSkillCatalog(options?.skills ?? []);
      if (catalog) {
        parts.push(catalog);
      }

      if (options?.activeSkill) {
        parts.push(formatActiveSkillBlock(options.activeSkill));
      }

      return parts.join('\n\n');
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
