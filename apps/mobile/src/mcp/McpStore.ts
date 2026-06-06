import AsyncStorage from '@react-native-async-storage/async-storage';

import type { McpServerConfig, McpToolDefinition } from './types';

const KEY_MCP_SERVERS = 'litertlm:mcp-servers';

export interface StoredMcpServer extends McpServerConfig {
  tools: McpToolDefinition[];
}

export class McpStore {
  async load(): Promise<StoredMcpServer[]> {
    const raw = await AsyncStorage.getItem(KEY_MCP_SERVERS);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as StoredMcpServer[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(isValidStoredMcpServer);
    } catch {
      return [];
    }
  }

  async save(servers: StoredMcpServer[]): Promise<void> {
    await AsyncStorage.setItem(KEY_MCP_SERVERS, JSON.stringify(servers));
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(KEY_MCP_SERVERS);
  }
}

function isValidStoredMcpServer(value: unknown): value is StoredMcpServer {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const server = value as StoredMcpServer;
  return (
    typeof server.id === 'string' &&
    typeof server.displayName === 'string' &&
    typeof server.url === 'string' &&
    typeof server.enabled === 'boolean' &&
    typeof server.installedAt === 'number' &&
    Array.isArray(server.tools)
  );
}
