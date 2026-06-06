import { describe, expect, it } from 'vitest';

import { ToolRegistry } from './registry';

describe('ToolRegistry', () => {
  it('includes built-in tools by default', () => {
    const registry = new ToolRegistry();
    const names = registry.listDefinitions().map((d) => d.name);
    expect(names).toContain('getCurrentTime');
    expect(names).toContain('openUrl');
  });

  it('get returns registered tool', () => {
    const registry = new ToolRegistry();
    expect(registry.get('getCurrentTime')?.definition.name).toBe('getCurrentTime');
    expect(registry.get('missing')).toBeUndefined();
  });

  it('register overrides tool handler', async () => {
    const registry = new ToolRegistry();
    registry.register(
      async () => ({ custom: true }),
      {
        name: 'customTool',
        description: 'test',
        parametersJsonSchema: {},
      },
    );
    const result = await registry.execute('customTool', {});
    expect(result).toEqual({ custom: true });
  });

  it('execute throws for unknown tool', async () => {
    const registry = new ToolRegistry();
    await expect(registry.execute('unknown', {})).rejects.toThrow('Unknown tool');
  });
});
