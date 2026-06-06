import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getSafeExpoDevice,
  resetSafeExpoDeviceCacheForTests,
  setDeviceLoaderForTests,
} from './safeExpoDevice';

describe('safeExpoDevice', () => {
  beforeEach(() => {
    resetSafeExpoDeviceCacheForTests();
    setDeviceLoaderForTests(() => ({
      modelName: 'Test Device',
      osVersion: '17.0',
      totalMemory: 8 * 1024 * 1024 * 1024,
    }));
  });

  afterEach(() => {
    setDeviceLoaderForTests(null);
    resetSafeExpoDeviceCacheForTests();
  });

  it('returns device info when expo-device is available', () => {
    const info = getSafeExpoDevice();
    expect(info.modelName).toBe('Test Device');
    expect(info.osVersion).toBe('17.0');
    expect(info.totalMemoryBytes).toBe(8 * 1024 * 1024 * 1024);
    expect(info.available).toBe(true);
  });

  it('returns cached value on subsequent calls', () => {
    const first = getSafeExpoDevice();
    const second = getSafeExpoDevice();
    expect(second).toBe(first);
  });

  it('returns unavailable fallback when loader throws', () => {
    setDeviceLoaderForTests(() => {
      throw new Error('native module missing');
    });
    resetSafeExpoDeviceCacheForTests();
    const info = getSafeExpoDevice();
    expect(info.available).toBe(false);
    expect(info.modelName).toBeNull();
  });
});
