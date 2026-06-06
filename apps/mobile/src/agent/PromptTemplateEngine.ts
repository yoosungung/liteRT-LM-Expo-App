import type { Message } from 'litertlm-native';

import { buildMcpCatalogEntries, formatMcpToolCatalog } from '../mcp/mcpToolCatalog';
import type { McpToolDefinition } from '../mcp/types';
import { formatActiveSkillBlock, formatSkillCatalog } from '../skills/skillCatalog';
import type { SkillRef } from '../skills/types';
import type { McpServerConfig } from '../mcp/types';

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
  mcpServers?: McpServerConfig[];
  mcpTools?: McpToolDefinition[];
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

      const mcpCatalog = formatMcpToolCatalog(
        buildMcpCatalogEntries(options?.mcpServers ?? [], groupMcpTools(options?.mcpTools ?? [])),
      );
      if (mcpCatalog) {
        parts.push(mcpCatalog);
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

function groupMcpTools(tools: McpToolDefinition[]): Record<string, McpToolDefinition[]> {
  return tools.reduce<Record<string, McpToolDefinition[]>>((acc, tool) => {
    acc[tool.serverId] = acc[tool.serverId] ?? [];
    acc[tool.serverId]!.push(tool);
    return acc;
  }, {});
}
