import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

vi.mock('expo-modules-core', () => ({
  requireNativeModule: vi.fn(),
}));

import {
  isNativeSha256VerifyAvailable,
  verifyFileSha256Native,
} from './verifySha256';

describe('verifySha256', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isNativeSha256VerifyAvailable is false on web', () => {
    expect(isNativeSha256VerifyAvailable()).toBe(false);
  });

  it('verifyFileSha256Native returns error when native is unavailable', async () => {
    const result = await verifyFileSha256Native('/path/model.litertlm', 'abc');
    expect(result).toEqual({
      ok: false,
      error: 'Native SHA-256 verify is not available on this platform',
    });
  });
});
