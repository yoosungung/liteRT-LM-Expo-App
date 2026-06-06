import type { McpUrlValidationResult } from './types';

export function validateMcpServerUrl(url: string): McpUrlValidationResult {
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'MCP server URL is required' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Invalid MCP server URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'MCP server URL must use HTTPS' };
  }

  return { ok: true, url: parsed.toString() };
}

export function validateMcpServerId(id: string): string | null {
  const trimmed = id.trim();
  if (trimmed.length < 1 || trimmed.length > 64) {
    return 'MCP server id is required (1-64 characters)';
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
    return 'Invalid MCP server id: must be lowercase kebab-case';
  }

  return null;
}

export function namespaceMcpToolName(serverId: string, toolName: string): string {
  return `mcp:${serverId}:${toolName}`;
}
