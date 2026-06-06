import { describe, expect, it, vi } from 'vitest';

import { createStreamableHttpMcpClient } from './StreamableHttpMcpClient';

describe('StreamableHttpMcpClient', () => {
  it('lists tools via JSON-RPC tools/list', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        jsonrpc: '2.0',
        id: 1,
        result: {
          tools: [
            {
              name: 'get_weather',
              description: 'Weather lookup.',
              inputSchema: { type: 'object' },
            },
          ],
        },
      }),
    })) as unknown as typeof fetch;

    const client = createStreamableHttpMcpClient(fetchFn);
    await client.connect('https://mcp.example.com/v1');
    const tools = await client.listTools();

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('get_weather');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://mcp.example.com/v1',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"method":"tools/list"'),
      }),
    );
  });

  it('calls tools via JSON-RPC tools/call', async () => {
    const fetchFn = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { method: string };
      if (body.method === 'tools/list') {
        return {
          ok: true,
          json: async () => ({ jsonrpc: '2.0', id: 1, result: { tools: [] } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 2,
          result: {
            content: [{ type: 'text', text: '{"tempC":22}' }],
          },
        }),
      };
    }) as unknown as typeof fetch;

    const client = createStreamableHttpMcpClient(fetchFn);
    await client.connect('https://mcp.example.com/v1');
    const result = await client.callTool('get_weather', { city: 'Seoul' });

    expect(result).toEqual({ tempC: 22 });
  });

  it('surfaces MCP JSON-RPC errors', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        jsonrpc: '2.0',
        id: 1,
        error: { message: 'Server unavailable' },
      }),
    })) as unknown as typeof fetch;

    const client = createStreamableHttpMcpClient(fetchFn);
    await client.connect('https://mcp.example.com/v1');
    await expect(client.listTools()).rejects.toThrow('Server unavailable');
  });
});
