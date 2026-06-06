import type { McpClient } from '../types';

export interface MockMcpTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  result: unknown;
}

export interface MockMcpClientOptions {
  tools?: MockMcpTool[];
}

export function createMockMcpClient(options: MockMcpClientOptions = {}): McpClient {
  const tools = options.tools ?? [
    {
      name: 'get_weather',
      description: 'Returns mock weather for a city.',
      inputSchema: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
      result: { city: 'Seoul', tempC: 22, condition: 'sunny' },
    },
  ];

  let connectedUrl: string | null = null;

  return {
    async connect(url) {
      connectedUrl = url;
    },

    async listTools() {
      if (!connectedUrl) {
        throw new Error('MockMcpClient is not connected');
      }

      return tools.map(({ name, description, inputSchema = {} }) => ({
        name,
        description,
        inputSchema,
      }));
    },

    async callTool(name, args) {
      if (!connectedUrl) {
        throw new Error('MockMcpClient is not connected');
      }

      const tool = tools.find((entry) => entry.name === name);
      if (!tool) {
        throw new Error(`Unknown MCP tool: ${name}`);
      }

      return typeof tool.result === 'function'
        ? (tool.result as (args: Record<string, unknown>) => unknown)(args)
        : tool.result;
    },

    async disconnect() {
      connectedUrl = null;
    },
  };
}
