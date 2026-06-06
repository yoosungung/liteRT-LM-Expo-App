export type DeepLinkRoute =
  | { type: 'chat'; sessionId: string; skillName?: string }
  | { type: 'skill'; skillName: string; sessionId?: string }
  | { type: 'warmup'; sessionId: string };

export function parseDeepLink(url: string): DeepLinkRoute | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'litertlm:') {
    return null;
  }

  const host = parsed.hostname;
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (host === 'chat') {
    const sessionId = segments[0] ?? parsed.searchParams.get('sessionId');
    if (!sessionId) {
      return null;
    }
    const skillName = parsed.searchParams.get('skill') ?? undefined;
    return { type: 'chat', sessionId, skillName };
  }

  if (host === 'skill') {
    const skillName = segments[0] ?? parsed.searchParams.get('name');
    if (!skillName) {
      return null;
    }
    const sessionId = parsed.searchParams.get('session') ?? undefined;
    return { type: 'skill', skillName, sessionId };
  }

  if (host === 'warmup') {
    const sessionId = segments[0] ?? parsed.searchParams.get('sessionId');
    if (!sessionId) {
      return null;
    }
    return { type: 'warmup', sessionId };
  }

  if (segments[0] === 'chat') {
    const sessionId = segments[1] ?? parsed.searchParams.get('sessionId');
    if (!sessionId) {
      return null;
    }
    const skillName = parsed.searchParams.get('skill') ?? undefined;
    return { type: 'chat', sessionId, skillName };
  }

  if (segments[0] === 'skill') {
    const skillName = segments[1] ?? parsed.searchParams.get('name');
    if (!skillName) {
      return null;
    }
    const sessionId = parsed.searchParams.get('session') ?? undefined;
    return { type: 'skill', skillName, sessionId };
  }

  if (segments[0] === 'warmup') {
    const sessionId = segments[1] ?? parsed.searchParams.get('sessionId');
    if (!sessionId) {
      return null;
    }
    return { type: 'warmup', sessionId };
  }

  return null;
}

export function buildChatDeepLink(sessionId: string, skillName?: string): string {
  const url = new URL(`litertlm://chat/${sessionId}`);
  if (skillName) {
    url.searchParams.set('skill', skillName);
  }
  return url.toString();
}

export function buildWarmUpDeepLink(sessionId: string): string {
  return `litertlm://warmup/${sessionId}`;
}
