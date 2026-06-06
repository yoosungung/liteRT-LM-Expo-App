import { describe, expect, it, vi } from 'vitest';

import * as Linking from 'expo-linking';

import { BUILTIN_TOOL_DEFINITIONS, createBuiltinJsTools } from './builtins';
import { defaultRequiresApproval } from './types';

describe('builtins', () => {
  it('classifies openUrl as destructive with approval (§1.10)', () => {
    const openUrl = BUILTIN_TOOL_DEFINITIONS.find((d) => d.name === 'openUrl');
    expect(openUrl?.riskLevel).toBe('destructive');
    expect(openUrl?.requiresApproval).toBe(true);
  });

  it('classifies getCurrentTime as read without approval', () => {
    const time = BUILTIN_TOOL_DEFINITIONS.find((d) => d.name === 'getCurrentTime');
    expect(time?.riskLevel).toBe('read');
    expect(defaultRequiresApproval('read')).toBe(false);
  });

  it('getCurrentTime handler returns iso string', async () => {
    const tools = createBuiltinJsTools();
    const time = tools.find((t) => t.definition.name === 'getCurrentTime')!;
    const result = (await time.handler({})) as { iso: string };
    expect(result.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('openUrl rejects non-http(s) URLs', async () => {
    const tools = createBuiltinJsTools();
    const openUrl = tools.find((t) => t.definition.name === 'openUrl')!;
    const result = (await openUrl.handler({ url: 'ftp://bad' })) as {
      opened: boolean;
      error?: string;
    };
    expect(result.opened).toBe(false);
    expect(result.error).toContain('http');
  });

  it('openUrl opens valid https URL', async () => {
    const tools = createBuiltinJsTools();
    const openUrl = tools.find((t) => t.definition.name === 'openUrl')!;
    const result = (await openUrl.handler({ url: 'https://example.com' })) as {
      opened: boolean;
      url: string;
    };
    expect(result.opened).toBe(true);
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
  });
});
