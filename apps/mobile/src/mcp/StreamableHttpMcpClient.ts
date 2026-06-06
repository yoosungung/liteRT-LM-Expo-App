import type { McpClient } from './types';

export type McpFetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface JsonRpcResponse<T> {
  jsonrpc?: string;
  id?: number | string;
  result?: T;
  error?: { message?: string; code?: number };
}

interface McpToolsListResult {
  tools: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
}

interface McpToolCallResult {
  content?: Array<{ type?: string; text?: string }>;
  isError?: boolean;
}

export function createStreamableHttpMcpClient(fetchFn: McpFetchFn = fetch): McpClient {
  let endpoint: string | null = null;
  let requestId = 0;

  const rpc = async <T>(method: string, params: Record<string, unknown>): Promise<T> => {
    if (!endpoint) {
      throw new Error('MCP client is not connected');
    }

    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++requestId,
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP request failed (${response.status})`);
    }

    const payload = (await response.json()) as JsonRpcResponse<T>;
    if (payload.error) {
      throw new Error(payload.error.message ?? 'MCP request failed');
    }
    if (payload.result === undefined) {
      throw new Error('MCP response missing result');
    }
    return payload.result;
  };

  return {
    async connect(url) {
      endpoint = url;
    },

    async listTools() {
      const result = await rpc<McpToolsListResult>('tools/list', {});
      return (result.tools ?? []).map((tool) => ({
        name: tool.name,
        description: tool.description ?? '',
        inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
      }));
    },

    async callTool(name, args) {
      const result = await rpc<McpToolCallResult>('tools/call', {
        name,
        arguments: args,
      });

      if (result.isError) {
        const message =
          result.content?.find((entry) => entry.type === 'text')?.text ?? 'MCP tool failed';
        throw new Error(message);
      }

      const text = result.content?.find((entry) => entry.type === 'text')?.text;
      if (text) {
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return { result: text };
        }
      }

      return result;
    },

    async disconnect() {
      endpoint = null;
      requestId = 0;
    },
  };
}
