import { describe, expect, it } from 'vitest';

import { McpServerRegistry } from './McpServerRegistry';

describe('McpServerRegistry', () => {
  it('registers and lists MCP servers', () => {
    const registry = new McpServerRegistry();
    registry.register({
      id: 'weather',
      displayName: 'Weather MCP',
      url: 'https://mcp.example.com/weather',
      enabled: true,
    });

    expect(registry.list()).toHaveLength(1);
    expect(registry.get('weather')?.displayName).toBe('Weather MCP');
  });

  it('rejects duplicate server ids', () => {
    const registry = new McpServerRegistry();
    registry.register({
      id: 'weather',
      displayName: 'Weather MCP',
      url: 'https://mcp.example.com/weather',
      enabled: true,
    });

    expect(() =>
      registry.register({
        id: 'weather',
        displayName: 'Duplicate',
        url: 'https://mcp.example.com/other',
        enabled: true,
      }),
    ).toThrow('MCP server already registered: weather');
  });

  it('enable/disable and unregister servers', () => {
    const registry = new McpServerRegistry();
    registry.register({
      id: 'weather',
      displayName: 'Weather MCP',
      url: 'https://mcp.example.com/weather',
      enabled: true,
    });

    expect(registry.setEnabled('weather', false)).toBe(true);
    expect(registry.listEnabled()).toHaveLength(0);

    expect(registry.unregister('weather')).toBe(true);
    expect(registry.get('weather')).toBeUndefined();
  });

  it('stores namespaced tools for enabled servers', () => {
    const registry = new McpServerRegistry();
    registry.register({
      id: 'weather',
      displayName: 'Weather MCP',
      url: 'https://mcp.example.com/weather',
      enabled: true,
    });

    registry.setTools('weather', [
      {
        name: 'get_forecast',
        description: 'Get weather forecast.',
        inputSchema: { type: 'object' },
      },
    ]);

    const tools = registry.listEnabledTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]?.namespacedName).toBe('mcp:weather:get_forecast');
    expect(registry.getTool('mcp:weather:get_forecast')?.description).toContain('forecast');
  });

  it('excludes tools from disabled servers', () => {
    const registry = new McpServerRegistry();
    registry.register({
      id: 'weather',
      displayName: 'Weather MCP',
      url: 'https://mcp.example.com/weather',
      enabled: false,
    });
    registry.setTools('weather', [
      {
        name: 'get_forecast',
        description: 'Get weather forecast.',
        inputSchema: { type: 'object' },
      },
    ]);

    expect(registry.listEnabledTools()).toHaveLength(0);
  });
});
