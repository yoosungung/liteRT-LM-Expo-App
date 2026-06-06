import { describe, expect, it } from 'vitest';

import { createMockMcpClient } from './mock/MockMcpClient';

describe('MockMcpClient', () => {
  it('lists tools after connect', async () => {
    const client = createMockMcpClient();
    await client.connect('https://mcp.example.com/v1');

    const tools = await client.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('get_weather');
  });

  it('returns mock tool results', async () => {
    const client = createMockMcpClient();
    await client.connect('https://mcp.example.com/v1');

    const result = await client.callTool('get_weather', { city: 'Seoul' });
    expect(result).toEqual({ city: 'Seoul', tempC: 22, condition: 'sunny' });
  });

  it('requires connect before listTools or callTool', async () => {
    const client = createMockMcpClient();
    await expect(client.listTools()).rejects.toThrow('MockMcpClient is not connected');
  });
});
