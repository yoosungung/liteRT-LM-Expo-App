import { describe, expect, it } from 'vitest';

import { getManifestEntry, MODEL_MANIFEST } from './manifest';

describe('MODEL_MANIFEST', () => {
  it('pins sha256 for E2B and E4B (§1.8)', () => {
    for (const entry of MODEL_MANIFEST) {
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(entry.minRamMb).toBeGreaterThan(0);
    }
  });

  it('getManifestEntry returns entry by id', () => {
    const e2b = getManifestEntry('gemma-4-e2b');
    expect(e2b.displayName).toContain('E2B');
    expect(e2b.minRamMb).toBe(4096);
  });

  it('getManifestEntry throws for unknown model', () => {
    expect(() => getManifestEntry('unknown' as 'gemma-4-e2b')).toThrow('Unknown model');
  });
});
