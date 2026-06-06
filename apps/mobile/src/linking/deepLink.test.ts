import { describe, expect, it } from 'vitest';

import { buildChatDeepLink, buildWarmUpDeepLink, parseDeepLink } from './deepLink';

describe('deepLink', () => {
  it('parses chat deep links', () => {
    expect(parseDeepLink('litertlm://chat/session-1?skill=fitness-coach')).toEqual({
      type: 'chat',
      sessionId: 'session-1',
      skillName: 'fitness-coach',
    });
  });

  it('parses skill deep links', () => {
    expect(parseDeepLink('litertlm://skill/fitness-coach?session=session-1')).toEqual({
      type: 'skill',
      skillName: 'fitness-coach',
      sessionId: 'session-1',
    });
  });

  it('parses warm-up deep links', () => {
    expect(parseDeepLink('litertlm://warmup/session-1')).toEqual({
      type: 'warmup',
      sessionId: 'session-1',
    });
  });

  it('builds chat and warm-up links', () => {
    expect(buildChatDeepLink('session-1', 'fitness-coach')).toBe(
      'litertlm://chat/session-1?skill=fitness-coach',
    );
    expect(buildWarmUpDeepLink('session-1')).toBe('litertlm://warmup/session-1');
  });
});
