export interface EasSubmitProfile {
  ios?: Record<string, unknown>;
  android?: Record<string, unknown>;
}

export interface EasBuildProfile {
  distribution?: string;
  developmentClient?: boolean;
  channel?: string;
  ios?: Record<string, unknown>;
  android?: Record<string, unknown>;
}

export interface EasConfigShape {
  build: Record<string, EasBuildProfile>;
  submit: Record<string, EasSubmitProfile>;
}

export const INTERNAL_TEST_PROFILES = ['preview', 'internal-test'] as const;

export function assertInternalTestProfiles(config: EasConfigShape): string[] {
  const missing = INTERNAL_TEST_PROFILES.filter((profile) => !(profile in config.build));
  if (missing.length > 0) {
    throw new Error(`Missing EAS internal test build profiles: ${missing.join(', ')}`);
  }

  if (!('internal-test' in config.submit)) {
    throw new Error('Missing EAS submit profile: internal-test');
  }

  return [...INTERNAL_TEST_PROFILES];
}

export function isInternalDistributionProfile(profile: EasBuildProfile | undefined): boolean {
  return profile?.distribution === 'internal';
}
