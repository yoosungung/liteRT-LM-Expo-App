import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import type { ToolDefinition } from 'litertlm-native';

import type { JsToolHandler, RegisteredTool } from './types';
import { defaultRequiresApproval } from './types';

export const INTENT_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'shareText',
    description: 'Share plain text via the system share sheet.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to share' },
        title: { type: 'string', description: 'Optional share dialog title (Android)' },
      },
      required: ['text'],
      additionalProperties: false,
    },
    riskLevel: 'destructive',
    requiresApproval: true,
  },
  {
    name: 'copyToClipboard',
    description: 'Copy plain text to the system clipboard.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to copy' },
      },
      required: ['text'],
      additionalProperties: false,
    },
    riskLevel: 'write',
    requiresApproval: true,
  },
  {
    name: 'readClipboard',
    description: 'Read plain text from the system clipboard.',
    parametersJsonSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    riskLevel: 'read',
    requiresApproval: false,
  },
];

export function createIntentJsTools(): RegisteredTool[] {
  const handlers: Record<string, JsToolHandler> = {
    async shareText(args) {
      const text = typeof args.text === 'string' ? args.text : '';
      if (!text.trim()) {
        return { shared: false, error: 'Text is required' };
      }
      const title = typeof args.title === 'string' ? args.title : undefined;
      await Share.share(title ? { message: text, title } : { message: text });
      return { shared: true };
    },
    async copyToClipboard(args) {
      const text = typeof args.text === 'string' ? args.text : '';
      if (!text.trim()) {
        return { copied: false, error: 'Text is required' };
      }
      await Clipboard.setStringAsync(text);
      return { copied: true };
    },
    async readClipboard() {
      const text = await Clipboard.getStringAsync();
      return { text: text ?? '' };
    },
  };

  return INTENT_TOOL_DEFINITIONS.map((definition) => ({
    definition,
    handler: handlers[definition.name]!,
    policy: {
      riskLevel: definition.riskLevel ?? 'write',
      requiresApproval:
        definition.requiresApproval ??
        defaultRequiresApproval(definition.riskLevel ?? 'write'),
    },
  }));
}
