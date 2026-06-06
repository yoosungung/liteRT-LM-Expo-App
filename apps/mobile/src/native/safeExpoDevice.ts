/** Lazy access to expo-device — avoids crash when dev client predates the dependency. */

export interface SafeDeviceInfo {
  modelName: string | null;
  osVersion: string | null;
  totalMemoryBytes: number | null;
  available: boolean;
}

let cached: SafeDeviceInfo | undefined;

export function getSafeExpoDevice(): SafeDeviceInfo {
  if (cached) {
    return cached;
  }

  try {
    // require at call time so routes load before native module is probed
    const Device = require('expo-device') as typeof import('expo-device');
    cached = {
      modelName: Device.modelName ?? null,
      osVersion: Device.osVersion ?? null,
      totalMemoryBytes: Device.totalMemory ?? null,
      available: true,
    };
  } catch {
    cached = {
      modelName: null,
      osVersion: null,
      totalMemoryBytes: null,
      available: false,
    };
  }

  return cached;
}
