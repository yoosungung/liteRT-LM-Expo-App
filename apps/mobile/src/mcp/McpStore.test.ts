import { describe, expect, it } from 'vitest';

import { McpStore } from './McpStore';

describe('McpStore', () => {
  it('save/load round-trips MCP servers with cached tools', async () => {
    const store = new McpStore();
    await store.save([
      {
        id: 'weather',
        displayName: 'Weather MCP',
        url: 'https://mcp.example.com/weather',
        enabled: true,
        installedAt: 1,
        tools: [
          {
            name: 'get_forecast',
            namespacedName: 'mcp:weather:get_forecast',
            description: 'Forecast lookup.',
            inputSchema: { type: 'object' },
            serverId: 'weather',
          },
        ],
      },
    ]);

    const loaded = await store.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.tools[0]?.namespacedName).toBe('mcp:weather:get_forecast');
  });

  it('returns empty array for corrupt JSON', async () => {
    const store = new McpStore();
    await store.clear();
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem('litertlm:mcp-servers', '{bad json');
    expect(await store.load()).toEqual([]);
  });
});
