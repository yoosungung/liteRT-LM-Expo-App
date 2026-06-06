import { describe, expect, it } from 'vitest';

import { namespaceMcpToolName, validateMcpServerId, validateMcpServerUrl } from './validateMcpUrl';

describe('validateMcpServerUrl', () => {
  it('accepts HTTPS MCP server URLs', () => {
    expect(validateMcpServerUrl('https://mcp.example.com/v1')).toEqual({
      ok: true,
      url: 'https://mcp.example.com/v1',
    });
  });

  it('trims whitespace before validation', () => {
    expect(validateMcpServerUrl('  https://localhost:8443/mcp  ')).toEqual({
      ok: true,
      url: 'https://localhost:8443/mcp',
    });
  });

  it('rejects HTTP URLs', () => {
    expect(validateMcpServerUrl('http://mcp.example.com/v1')).toEqual({
      ok: false,
      error: 'MCP server URL must use HTTPS',
    });
  });

  it('rejects empty and invalid URLs', () => {
    expect(validateMcpServerUrl('')).toEqual({
      ok: false,
      error: 'MCP server URL is required',
    });
    expect(validateMcpServerUrl('not-a-url')).toEqual({
      ok: false,
      error: 'Invalid MCP server URL',
    });
  });
});

describe('validateMcpServerId', () => {
  it('accepts lowercase kebab-case ids', () => {
    expect(validateMcpServerId('home-assistant')).toBeNull();
  });

  it('rejects invalid ids', () => {
    expect(validateMcpServerId('HomeAssistant')).toBe(
      'Invalid MCP server id: must be lowercase kebab-case',
    );
    expect(validateMcpServerId('')).toBe('MCP server id is required (1-64 characters)');
  });
});

describe('namespaceMcpToolName', () => {
  it('prefixes tool names with server id', () => {
    expect(namespaceMcpToolName('weather', 'get_forecast')).toBe('mcp:weather:get_forecast');
  });
});
