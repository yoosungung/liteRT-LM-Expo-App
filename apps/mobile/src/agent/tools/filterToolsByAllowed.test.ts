import { describe, expect, it } from 'vitest';

import type { ToolDefinition } from 'litertlm-native';

import { filterToolsByAllowed } from './filterToolsByAllowed';

const TOOLS: ToolDefinition[] = [
  { name: 'getCurrentTime', description: 't', parametersJsonSchema: {} },
  { name: 'openUrl', description: 'u', parametersJsonSchema: {} },
  { name: 'shareText', description: 's', parametersJsonSchema: {} },
  { name: 'run_js', description: 'j', parametersJsonSchema: {} },
];

describe('filterToolsByAllowed', () => {
  it('returns all tools when allowed-tools is undefined', () => {
    expect(filterToolsByAllowed(TOOLS, undefined)).toEqual(TOOLS);
  });

  it('returns all tools when allowed-tools is blank', () => {
    expect(filterToolsByAllowed(TOOLS, '   ')).toEqual(TOOLS);
  });

  it('filters to comma-separated allow list', () => {
    const filtered = filterToolsByAllowed(TOOLS, 'openUrl, shareText');
    expect(filtered.map((t) => t.name)).toEqual(['openUrl', 'shareText']);
  });

  it('always keeps run_js when includeRunJs is true', () => {
    const filtered = filterToolsByAllowed(TOOLS, 'openUrl', { includeRunJs: true });
    expect(filtered.map((t) => t.name)).toEqual(['openUrl', 'run_js']);
  });
});
