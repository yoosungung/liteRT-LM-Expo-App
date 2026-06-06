export interface McpServerConfig {
  id: string;
  displayName: string;
  url: string;
  enabled: boolean;
  installedAt: number;
}

export interface McpToolDefinition {
  name: string;
  namespacedName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
}

export type McpServerRegisterInput = Omit<McpServerConfig, 'installedAt'>;

export type McpUrlValidationResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export interface McpClient {
  connect(url: string): Promise<void>;
  listTools(): Promise<
    Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>
  >;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  disconnect(): Promise<void>;
}
