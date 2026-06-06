import { describe, expect, it, vi, beforeEach } from 'vitest';

import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

import { createIntentJsTools, INTENT_TOOL_DEFINITIONS } from './intentTools';

describe('intentTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('classifies shareText as destructive with approval', () => {
    const share = INTENT_TOOL_DEFINITIONS.find((d) => d.name === 'shareText');
    expect(share?.riskLevel).toBe('destructive');
    expect(share?.requiresApproval).toBe(true);
  });

  it('shareText invokes React Native Share', async () => {
    const tools = createIntentJsTools();
    const share = tools.find((t) => t.definition.name === 'shareText')!;
    const result = (await share.handler({ text: 'hello world' })) as { shared: boolean };
    expect(result.shared).toBe(true);
    expect(Share.share).toHaveBeenCalledWith({ message: 'hello world' });
  });

  it('copyToClipboard writes via expo-clipboard', async () => {
    const tools = createIntentJsTools();
    const copy = tools.find((t) => t.definition.name === 'copyToClipboard')!;
    const result = (await copy.handler({ text: 'copy me' })) as { copied: boolean };
    expect(result.copied).toBe(true);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('copy me');
  });

  it('readClipboard returns clipboard text', async () => {
    const tools = createIntentJsTools();
    const read = tools.find((t) => t.definition.name === 'readClipboard')!;
    const result = (await read.handler({})) as { text: string };
    expect(result.text).toBe('clipboard-value');
  });
});
