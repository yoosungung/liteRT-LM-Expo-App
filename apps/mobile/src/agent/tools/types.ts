import type { ToolDefinition, ToolRiskLevel } from 'litertlm-native';

export type JsToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export interface ToolPolicy {
  riskLevel?: ToolRiskLevel;
  requiresApproval?: boolean;
}

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: JsToolHandler;
  policy: ToolPolicy;
}

export function defaultRequiresApproval(riskLevel: ToolRiskLevel): boolean {
  return riskLevel === 'write' || riskLevel === 'destructive';
}
