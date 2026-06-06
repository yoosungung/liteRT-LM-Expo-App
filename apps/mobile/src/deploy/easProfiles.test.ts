import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  assertInternalTestProfiles,
  isInternalDistributionProfile,
} from './easProfiles';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const easJson = JSON.parse(
  readFileSync(join(fixtureDir, '../../eas.json'), 'utf8'),
) as {
  build: Record<string, { distribution?: string }>;
  submit: Record<string, unknown>;
};

describe('easProfiles', () => {
  it('validates internal test build and submit profiles (4.4)', () => {
    expect(assertInternalTestProfiles(easJson)).toEqual(['preview', 'internal-test']);
  });

  it('detects internal distribution profiles', () => {
    expect(isInternalDistributionProfile({ distribution: 'internal' })).toBe(true);
    expect(isInternalDistributionProfile({ distribution: 'store' })).toBe(false);
  });
});
