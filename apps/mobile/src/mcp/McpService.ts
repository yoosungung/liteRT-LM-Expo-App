import type { McpClient } from './types';
import { McpServerRegistry } from './McpServerRegistry';
import { mcpToolToDefinition } from './mcpToolPolicy';
import { validateMcpServerId, validateMcpServerUrl } from './validateMcpUrl';
import type { McpServerRegisterInput } from './types';

export interface McpToolExecutor {
  registerMcpTool(
    definition: ReturnType<typeof mcpToolToDefinition>,
    execute: (args: Record<string, unknown>) => Promise<unknown>,
  ): void;
  unregisterMcpToolsForServer(serverId: string): void;
}

export class McpService {
  readonly registry = new McpServerRegistry();
  private clients = new Map<string, McpClient>();

  constructor(private createClient: () => McpClient = () => {
    throw new Error('MCP client factory not configured');
  }) {}

  registerServer(input: McpServerRegisterInput): void {
    const idError = validateMcpServerId(input.id);
    if (idError) {
      throw new Error(idError);
    }

    const urlResult = validateMcpServerUrl(input.url);
    if (!urlResult.ok) {
      throw new Error(urlResult.error);
    }

    this.registry.register({
      ...input,
      url: urlResult.url,
    });
  }

  setClientForServer(serverId: string, client: McpClient): void {
    this.clients.set(serverId, client);
  }

  getClientForServer(serverId: string): McpClient | undefined {
    return this.clients.get(serverId);
  }

  async syncServerTools(serverId: string, client?: McpClient): Promise<number> {
    const server = this.registry.get(serverId);
    if (!server) {
      throw new Error(`Unknown MCP server: ${serverId}`);
    }

    const resolvedClient = client ?? this.clients.get(serverId) ?? this.createClient();
    this.clients.set(serverId, resolvedClient);

    await resolvedClient.connect(server.url);
    const tools = await resolvedClient.listTools();
    this.registry.setTools(
      serverId,
      tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    );
    return tools.length;
  }

  async executeTool(namespacedName: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.registry.getTool(namespacedName);
    if (!tool) {
      throw new Error(`Unknown MCP tool: ${namespacedName}`);
    }

    const server = this.registry.get(tool.serverId);
    if (!server?.enabled) {
      throw new Error(`MCP server disabled: ${tool.serverId}`);
    }

    const client = this.clients.get(tool.serverId);
    if (!client) {
      throw new Error(`MCP client not connected: ${tool.serverId}`);
    }

    return client.callTool(tool.name, args);
  }

  bindToolsToRegistry(serverId: string, executor: McpToolExecutor): void {
    executor.unregisterMcpToolsForServer(serverId);
    const tools = this.registry.listEnabledTools().filter((tool) => tool.serverId === serverId);
    for (const tool of tools) {
      const definition = mcpToolToDefinition(tool);
      executor.registerMcpTool(definition, (args) => this.executeTool(tool.namespacedName, args));
    }
  }
}
