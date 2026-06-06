import type { ToolDefinition } from 'litertlm-native';

import { createBuiltinJsTools } from './builtins';
import type { JsToolHandler, RegisteredTool, ToolPolicy } from './types';
import { defaultRequiresApproval } from './types';

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  constructor() {
    for (const tool of createBuiltinJsTools()) {
      this.tools.set(tool.definition.name, tool);
    }
  }

  register(handler: JsToolHandler, definition: ToolDefinition, policy?: ToolPolicy): void {
    const riskLevel = policy?.riskLevel ?? definition.riskLevel ?? 'write';
    this.tools.set(definition.name, {
      definition,
      handler,
      policy: {
        riskLevel,
        requiresApproval:
          policy?.requiresApproval ??
          definition.requiresApproval ??
          defaultRequiresApproval(riskLevel),
      },
    });
  }

  listDefinitions(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => t.definition);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.handler(args);
  }
}
