import Constants from 'expo-constants';
import { afterEach, describe, expect, it } from 'vitest';

import { defaultPreferredBackend, isEmulator, resolvePreferredBackend } from './deviceProfile';

describe('deviceProfile', () => {
  const original = Constants.isDevice;

  afterEach(() => {
    (Constants as { isDevice: boolean }).isDevice = original;
  });

  it('isEmulator reflects Constants.isDevice', () => {
    (Constants as { isDevice: boolean }).isDevice = false;
    expect(isEmulator()).toBe(true);
    (Constants as { isDevice: boolean }).isDevice = true;
    expect(isEmulator()).toBe(false);
  });

  it('resolvePreferredBackend forces cpu on emulator', () => {
    (Constants as { isDevice: boolean }).isDevice = false;
    expect(resolvePreferredBackend('gpu')).toBe('cpu');
  });

  it('resolvePreferredBackend keeps gpu on physical device', () => {
    (Constants as { isDevice: boolean }).isDevice = true;
    expect(resolvePreferredBackend('gpu')).toBe('gpu');
  });

  it('defaultPreferredBackend picks cpu on emulator', () => {
    (Constants as { isDevice: boolean }).isDevice = false;
    expect(defaultPreferredBackend()).toBe('cpu');
  });
});
