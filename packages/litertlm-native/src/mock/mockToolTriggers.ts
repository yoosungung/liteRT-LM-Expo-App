import type { ToolCall, ToolRiskLevel } from '../LitertLm.types';

export interface MockToolTrigger {
  name: string;
  args: Record<string, unknown>;
  riskLevel: ToolRiskLevel;
  requiresApproval: boolean;
}

export function detectMockTool(text: string): MockToolTrigger | null {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (/what time|current time|지금.*시간|몇 시/.test(lower)) {
    return {
      name: 'getCurrentTime',
      args: {},
      riskLevel: 'read',
      requiresApproval: false,
    };
  }

  if (/device info|기기 정보|디바이스/.test(lower)) {
    return {
      name: 'getDeviceInfo',
      args: {},
      riskLevel: 'read',
      requiresApproval: false,
    };
  }

  const urlMatch = trimmed.match(/open\s+(https?:\/\/\S+)/i);
  if (urlMatch) {
    return {
      name: 'openUrl',
      args: { url: urlMatch[1]!.replace(/[.,;!?]+$/, '') },
      riskLevel: 'destructive',
      requiresApproval: true,
    };
  }

  if (/mcp weather|get weather via mcp/.test(lower)) {
    return {
      name: 'mcp:weather:get_weather',
      args: { city: 'Seoul' },
      riskLevel: 'read',
      requiresApproval: false,
    };
  }

  if (/\/hash-demo\b|reverse text|run_js/.test(lower)) {
    const textMatch = trimmed.match(/reverse\s+(.+)/i);
    const text = textMatch?.[1]?.trim() || trimmed.replace(/^\/hash-demo\s*/i, '').trim() || 'hello';
    return {
      name: 'run_js',
      args: {
        scriptName: 'index.html',
        data: JSON.stringify({ text }),
      },
      riskLevel: 'write',
      requiresApproval: false,
    };
  }

  return null;
}

export function createToolCall(conversationId: string, trigger: MockToolTrigger): ToolCall {
  return {
    id: `${conversationId}-tool-${Date.now()}`,
    name: trigger.name,
    argumentsJson: JSON.stringify(trigger.args),
  };
}

export function mockReadToolResult(name: string): Record<string, unknown> {
  if (name === 'getCurrentTime') {
    return { iso: new Date().toISOString() };
  }
  if (name === 'getDeviceInfo') {
    return { platform: 'mock', note: 'Use JS registry on manual path' };
  }
  return { ok: true };
}
