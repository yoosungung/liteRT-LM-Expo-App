import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import type { ToolDefinition } from 'litertlm-native';

import { getSafeExpoDevice } from '../../native/safeExpoDevice';
import type { JsToolHandler, RegisteredTool } from './types';
import { defaultRequiresApproval } from './types';

/** Built-in tool definitions — native @Tool parity target (Phase 2.1). */
export const BUILTIN_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'getCurrentTime',
    description: 'Get the current local time as an ISO-8601 string.',
    parametersJsonSchema: { type: 'object', properties: {}, additionalProperties: false },
    riskLevel: 'read',
    requiresApproval: false,
  },
  {
    name: 'getDeviceInfo',
    description: 'Get basic device info (platform, model, OS version).',
    parametersJsonSchema: { type: 'object', properties: {}, additionalProperties: false },
    riskLevel: 'read',
    requiresApproval: false,
  },
  {
    name: 'openUrl',
    description: 'Open a URL in the system browser.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'HTTPS URL to open' },
      },
      required: ['url'],
      additionalProperties: false,
    },
    riskLevel: 'destructive',
    requiresApproval: true,
  },
];

/** JS handlers for manual tool mode (Phase 2.2). Native automatic mode uses Kotlin/Swift ToolSet. */
export function createBuiltinJsTools(): RegisteredTool[] {
  const handlers: Record<string, JsToolHandler> = {
    async getCurrentTime() {
      return { iso: new Date().toISOString() };
    },
    async getDeviceInfo() {
      const device = getSafeExpoDevice();
      return {
        platform: Platform.OS,
        modelName: device.modelName ?? 'unknown',
        osVersion: device.osVersion ?? 'unknown',
        isDevice: Constants.isDevice,
        ...(device.available
          ? {}
          : { note: 'Rebuild dev client (`pnpm mobile android`) for full expo-device info' }),
      };
    },
    async openUrl(args) {
      const url = typeof args.url === 'string' ? args.url : '';
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { opened: false, url, error: 'Only http(s) URLs are supported' };
      }
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        return { opened: false, url, error: 'URL cannot be opened' };
      }
      await Linking.openURL(url);
      return { opened: true, url };
    },
  };

  return BUILTIN_TOOL_DEFINITIONS.map((definition) => ({
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
