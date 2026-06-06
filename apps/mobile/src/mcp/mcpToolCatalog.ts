import type { McpServerConfig, McpToolDefinition } from './types';

export const MCP_CATALOG_PREAMBLE = `## MCP Tools (Connected)

The following tools are provided by registered MCP servers. When the user's request requires external data or actions exposed by these tools, call the namespaced tool name exactly as listed.

**Important:** MCP tools require network access at execution time only. Inference and tool selection remain on-device.`;

export interface McpCatalogServerEntry {
  server: McpServerConfig;
  tools: McpToolDefinition[];
}

export function formatMcpToolCatalog(entries: McpCatalogServerEntry[]): string {
  const enabledEntries = entries.filter(({ server }) => server.enabled);
  const toolLines = enabledEntries.flatMap(({ server, tools }) => {
    if (tools.length === 0) {
      return [];
    }

    const header = `### Server: ${server.displayName} (\`${server.id}\`)`;
    const lines = tools.map(
      (tool) => `- **${tool.namespacedName}**: ${tool.description}`,
    );
    return [header, ...lines];
  });

  if (toolLines.length === 0) {
    return '';
  }

  return `${MCP_CATALOG_PREAMBLE}\n\n${toolLines.join('\n')}`;
}

export function buildMcpCatalogEntries(
  servers: McpServerConfig[],
  toolsByServerId: Record<string, McpToolDefinition[]>,
): McpCatalogServerEntry[] {
  return servers.map((server) => ({
    server,
    tools: toolsByServerId[server.id] ?? [],
  }));
}
