import type { ToolDefinition, ToolRiskLevel } from 'litertlm-native';

import type { McpToolDefinition } from './types';

const WRITE_HINTS = /\b(create|update|delete|send|post|write|set|remove|share|open)\b/i;
const READ_HINTS = /\b(get|list|fetch|read|search|find|lookup|describe)\b/i;

export function classifyMcpToolRisk(
  tool: Pick<McpToolDefinition, 'name' | 'description'> & {
    inputSchema?: Record<string, unknown>;
  },
): ToolRiskLevel {
  const annotations = tool.inputSchema?.annotations as { readOnlyHint?: boolean } | undefined;
  if (annotations?.readOnlyHint === true) {
    return 'read';
  }

  const haystack = `${tool.name} ${tool.description}`;
  if (WRITE_HINTS.test(haystack)) {
    return 'write';
  }
  if (READ_HINTS.test(haystack)) {
    return 'read';
  }
  return 'write';
}

export function requiresMcpToolApproval(tool: Pick<McpToolDefinition, 'name' | 'description'>): boolean {
  const risk = classifyMcpToolRisk(tool);
  return risk !== 'read';
}

export function mcpToolToDefinition(tool: McpToolDefinition): ToolDefinition {
  const riskLevel = classifyMcpToolRisk(tool);
  return {
    name: tool.namespacedName,
    description: tool.description,
    parametersJsonSchema: tool.inputSchema,
    riskLevel,
    requiresApproval: requiresMcpToolApproval(tool),
  };
}
