import { describe, expect, it } from 'vitest';

import { classifyMcpToolRisk, mcpToolToDefinition, requiresMcpToolApproval } from './mcpToolPolicy';

describe('mcpToolPolicy', () => {
  it('classifies read tools as read risk', () => {
    expect(
      classifyMcpToolRisk({ name: 'get_weather', description: 'Get weather forecast for a city.' }),
    ).toBe('read');
    expect(requiresMcpToolApproval({ name: 'get_weather', description: 'Get weather forecast.' })).toBe(
      false,
    );
  });

  it('requires approval for unknown side-effect tools (§1.15 default)', () => {
    expect(
      classifyMcpToolRisk({ name: 'do_something', description: 'Performs an action on the server.' }),
    ).toBe('write');
    expect(requiresMcpToolApproval({ name: 'do_something', description: 'Performs an action.' })).toBe(
      true,
    );
  });

  it('maps MCP tools to ToolDefinition with namespaced name', () => {
    const definition = mcpToolToDefinition({
      name: 'get_forecast',
      namespacedName: 'mcp:weather:get_forecast',
      description: 'Get weather forecast.',
      inputSchema: { type: 'object' },
      serverId: 'weather',
    });

    expect(definition.name).toBe('mcp:weather:get_forecast');
    expect(definition.requiresApproval).toBe(false);
  });
});
