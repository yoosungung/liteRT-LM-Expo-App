import { describe, expect, it, beforeEach } from 'vitest';
import { MockEngine, type ConversationConfig } from 'litertlm-native';

import { AgentRuntime } from './AgentRuntime';
import { McpStore } from '../mcp/McpStore';

describe('AgentRuntime MCP setup', () => {
  beforeEach(async () => {
    await new McpStore().clear();
  });

  it('registers, syncs, and executes MCP tools via service', async () => {
    const runtime = new AgentRuntime(new MockEngine());
    await runtime.registerMcpServer({
      id: 'weather',
      displayName: 'Weather MCP',
      url: 'https://mcp.example.com/weather',
      enabled: true,
    });
    await runtime.syncMcpServer('weather');
    expect(runtime.toolRegistry.get('mcp:weather:get_weather')).toBeDefined();
    await expect(
      runtime.mcpService.executeTool('mcp:weather:get_weather', { city: 'Seoul' }),
    ).resolves.toEqual({ city: 'Seoul', tempC: 22, condition: 'sunny' });
  });

  it('includes MCP catalog in conversation config', async () => {
    class ConfigCapturingMockEngine extends MockEngine {
      lastConversationConfig: ConversationConfig | null = null;

      async createConversation(config: ConversationConfig): Promise<void> {
        this.lastConversationConfig = config;
        return super.createConversation(config);
      }
    }

    const engine = new ConfigCapturingMockEngine();
    const runtime = new AgentRuntime(engine);
    await runtime.registerMcpServer({
      id: 'weather',
      displayName: 'Weather MCP',
      url: 'https://mcp.example.com/weather',
      enabled: true,
    });
    await runtime.syncMcpServer('weather');
    await runtime.createSession();
    expect(engine.lastConversationConfig?.systemInstruction).toContain('## MCP Tools (Connected)');
  });
});
