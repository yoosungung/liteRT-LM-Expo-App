import { describe, expect, it } from 'vitest';

import { createToolCall, detectMockTool, mockReadToolResult } from './mockToolTriggers';

describe('detectMockTool', () => {
  it('detects getCurrentTime from English prompt', () => {
    const trigger = detectMockTool('what time is it?');
    expect(trigger?.name).toBe('getCurrentTime');
    expect(trigger?.requiresApproval).toBe(false);
  });

  it('detects getDeviceInfo', () => {
    const trigger = detectMockTool('show device info');
    expect(trigger?.name).toBe('getDeviceInfo');
  });

  it('detects openUrl with approval required (§1.10)', () => {
    const trigger = detectMockTool('open https://example.com please');
    expect(trigger?.name).toBe('openUrl');
    expect(trigger?.requiresApproval).toBe(true);
    expect(trigger?.args).toEqual({ url: 'https://example.com' });
  });

  it('returns null for unrelated prompts', () => {
    expect(detectMockTool('hello world')).toBeNull();
  });
});

describe('createToolCall', () => {
  it('creates tool call with conversation-scoped id', () => {
    const trigger = detectMockTool('what time is it?')!;
    const call = createToolCall('conv-1', trigger);
    expect(call.name).toBe('getCurrentTime');
    expect(call.id).toContain('conv-1-tool-');
  });
});

describe('mockReadToolResult', () => {
  it('returns iso timestamp for getCurrentTime', () => {
    const result = mockReadToolResult('getCurrentTime');
    expect(result).toHaveProperty('iso');
  });
});
