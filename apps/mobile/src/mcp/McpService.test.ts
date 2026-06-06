import { describe, expect, it } from 'vitest';

import { createMockMcpClient } from './mock/MockMcpClient';
import { McpService } from './McpService';

describe('McpService', () => {
  it('registers server, syncs tools, and executes namespaced tool', async () => {
    const service = new McpService(() => createMockMcpClient());
    service.registerServer({
      id: 'weather',
      displayName: 'Weather MCP',
      url: 'https://mcp.example.com/weather',
      enabled: true,
    });

    const count = await service.syncServerTools('weather');
    expect(count).toBe(1);

    const result = await service.executeTool('mcp:weather:get_weather', { city: 'Seoul' });
    expect(result).toEqual({ city: 'Seoul', tempC: 22, condition: 'sunny' });
  });

  it('binds synced tools into JS registry executor', async () => {
    const service = new McpService(() => createMockMcpClient());
    service.registerServer({
      id: 'weather',
      displayName: 'Weather MCP',
      url: 'https://mcp.example.com/weather',
      enabled: true,
    });
    await service.syncServerTools('weather');

    const registered: string[] = [];
    service.bindToolsToRegistry('weather', {
      registerMcpTool(definition, execute) {
        registered.push(definition.name);
        void execute({ city: 'Seoul' });
      },
      unregisterMcpToolsForServer() {},
    });

    expect(registered).toEqual(['mcp:weather:get_weather']);
  });

  it('rejects invalid server URLs at registration', () => {
    const service = new McpService();
    expect(() =>
      service.registerServer({
        id: 'bad',
        displayName: 'Bad',
        url: 'http://insecure.example.com',
        enabled: true,
      }),
    ).toThrow('HTTPS');
  });
});
