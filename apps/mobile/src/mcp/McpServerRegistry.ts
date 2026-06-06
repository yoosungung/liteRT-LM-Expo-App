import { namespaceMcpToolName } from './validateMcpUrl';
import type { McpServerConfig, McpServerRegisterInput, McpToolDefinition } from './types';

interface StoredMcpServer extends McpServerConfig {
  tools: McpToolDefinition[];
}

export type { StoredMcpServer };

export class McpServerRegistry {
  private servers = new Map<string, StoredMcpServer>();

  register(config: McpServerRegisterInput): void {
    if (this.servers.has(config.id)) {
      throw new Error(`MCP server already registered: ${config.id}`);
    }

    this.servers.set(config.id, {
      ...config,
      installedAt: Date.now(),
      tools: [],
    });
  }

  hydrate(servers: Array<McpServerConfig & { tools?: McpToolDefinition[] }>): void {
    this.servers.clear();
    for (const server of servers) {
      this.servers.set(server.id, {
        ...server,
        tools: server.tools ?? [],
      });
    }
  }

  unregister(id: string): boolean {
    return this.servers.delete(id);
  }

  list(): McpServerConfig[] {
    return [...this.servers.values()]
      .map(({ tools: _tools, ...config }) => config)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  listEnabled(): McpServerConfig[] {
    return this.list().filter((server) => server.enabled);
  }

  get(id: string): McpServerConfig | undefined {
    const server = this.servers.get(id);
    if (!server) {
      return undefined;
    }

    const { tools: _tools, ...config } = server;
    return config;
  }

  setEnabled(id: string, enabled: boolean): boolean {
    const server = this.servers.get(id);
    if (!server) {
      return false;
    }

    server.enabled = enabled;
    return true;
  }

  setTools(serverId: string, tools: Array<Omit<McpToolDefinition, 'namespacedName' | 'serverId'>>): void {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Unknown MCP server: ${serverId}`);
    }

    server.tools = tools.map((tool) => ({
      ...tool,
      serverId,
      namespacedName: namespaceMcpToolName(serverId, tool.name),
    }));
  }

  listEnabledTools(): McpToolDefinition[] {
    return [...this.servers.values()]
      .filter((server) => server.enabled)
      .flatMap((server) => server.tools);
  }

  getTool(namespacedName: string): McpToolDefinition | undefined {
    for (const server of this.servers.values()) {
      const tool = server.tools.find((entry) => entry.namespacedName === namespacedName);
      if (tool) {
        return tool;
      }
    }
    return undefined;
  }

  exportStoredServers(): StoredMcpServer[] {
    return [...this.servers.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }
}
