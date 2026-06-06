/** Lazy access to expo-device — avoids crash when dev client predates the dependency. */

export interface SafeDeviceInfo {
  modelName: string | null;
  osVersion: string | null;
  totalMemoryBytes: number | null;
  available: boolean;
}

let cached: SafeDeviceInfo | undefined;

type ExpoDeviceModule = Pick<
  typeof import('expo-device'),
  'modelName' | 'osVersion' | 'totalMemory'
>;

function defaultLoadExpoDeviceModule(): ExpoDeviceModule {
  const loaded = require('expo-device') as ExpoDeviceModule & {
    default?: ExpoDeviceModule;
  };
  return loaded.default ?? loaded;
}

const deviceLoader = {
  load: defaultLoadExpoDeviceModule,
};

/** @internal test-only */
export function setDeviceLoaderForTests(loader: (() => ExpoDeviceModule) | null): void {
  deviceLoader.load = loader ?? defaultLoadExpoDeviceModule;
  cached = undefined;
}

/** @internal test-only cache reset */
export function resetSafeExpoDeviceCacheForTests(): void {
  cached = undefined;
}

export function getSafeExpoDevice(): SafeDeviceInfo {
  if (cached) {
    return cached;
  }

  try {
    const Device = deviceLoader.load();
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
