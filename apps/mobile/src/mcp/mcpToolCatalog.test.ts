import { describe, expect, it } from 'vitest';

import { buildMcpCatalogEntries, formatMcpToolCatalog } from './mcpToolCatalog';

describe('formatMcpToolCatalog', () => {
  it('returns empty string when no enabled tools exist', () => {
    expect(
      formatMcpToolCatalog([
        {
          server: {
            id: 'weather',
            displayName: 'Weather MCP',
            url: 'https://mcp.example.com/weather',
            enabled: false,
            installedAt: 1,
          },
          tools: [
            {
              name: 'get_forecast',
              namespacedName: 'mcp:weather:get_forecast',
              description: 'Forecast lookup.',
              inputSchema: { type: 'object' },
              serverId: 'weather',
            },
          ],
        },
      ]),
    ).toBe('');
  });

  it('formats enabled MCP tools with namespaced names', () => {
    const catalog = formatMcpToolCatalog(
      buildMcpCatalogEntries(
        [
          {
            id: 'weather',
            displayName: 'Weather MCP',
            url: 'https://mcp.example.com/weather',
            enabled: true,
            installedAt: 1,
          },
        ],
        {
          weather: [
            {
              name: 'get_forecast',
              namespacedName: 'mcp:weather:get_forecast',
              description: 'Forecast lookup.',
              inputSchema: { type: 'object' },
              serverId: 'weather',
            },
          ],
        },
      ),
    );

    expect(catalog).toContain('## MCP Tools (Connected)');
    expect(catalog).toContain('### Server: Weather MCP (`weather`)');
    expect(catalog).toContain('**mcp:weather:get_forecast**: Forecast lookup.');
  });
});
