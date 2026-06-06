import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as safeExpoDevice from '../native/safeExpoDevice';
import { getDeviceRamMb, meetsMinRamForModel, ramGateMessage } from './deviceRam';

describe('deviceRam', () => {
  beforeEach(() => {
    safeExpoDevice.resetSafeExpoDeviceCacheForTests();
    vi.spyOn(safeExpoDevice, 'getSafeExpoDevice').mockReturnValue({
      modelName: 'Test',
      osVersion: '17',
      totalMemoryBytes: 6 * 1024 * 1024 * 1024,
      available: true,
    });
  });

  it('getDeviceRamMb converts bytes to MB', () => {
    expect(getDeviceRamMb()).toBe(6144);
  });

  it('meetsMinRamForModel passes when RAM is sufficient', () => {
    expect(meetsMinRamForModel('gemma-4-e2b')).toBe(true);
  });

  it('meetsMinRamForModel fails for E4B on low-RAM device', () => {
    vi.spyOn(safeExpoDevice, 'getSafeExpoDevice').mockReturnValue({
      modelName: 'Test',
      osVersion: '17',
      totalMemoryBytes: 4 * 1024 * 1024 * 1024,
      available: true,
    });
    expect(meetsMinRamForModel('gemma-4-e4b')).toBe(false);
  });

  it('ramGateMessage returns guidance when blocked', () => {
    vi.spyOn(safeExpoDevice, 'getSafeExpoDevice').mockReturnValue({
      modelName: 'Test',
      osVersion: '17',
      totalMemoryBytes: 4 * 1024 * 1024 * 1024,
      available: true,
    });
    const msg = ramGateMessage('gemma-4-e4b');
    expect(msg).toContain('8192');
    expect(msg).toContain('E2B');
  });

  it('allows model when RAM is unknown', () => {
    vi.spyOn(safeExpoDevice, 'getSafeExpoDevice').mockReturnValue({
      modelName: null,
      osVersion: null,
      totalMemoryBytes: null,
      available: false,
    });
    expect(meetsMinRamForModel('gemma-4-e4b')).toBe(true);
    expect(ramGateMessage('gemma-4-e4b')).toBeNull();
  });
});
