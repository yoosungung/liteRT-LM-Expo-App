export const HF_OAUTH_AUTHORIZE_URL = 'https://huggingface.co/oauth/authorize';
export const HF_OAUTH_TOKEN_URL = 'https://huggingface.co/oauth/token';

export interface HfOAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
}

export function buildHfOAuthAuthorizeUrl(config: HfOAuthConfig, state: string): string {
  const url = new URL(HF_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('scope', (config.scopes ?? ['read-repos']).join(' '));
  return url.toString();
}

export type HfOAuthFetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function exchangeHfOAuthCode(
  code: string,
  config: HfOAuthConfig,
  fetchFn: HfOAuthFetchFn = fetch,
): Promise<{ accessToken: string }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
  });

  const response = await fetchFn(HF_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`HF OAuth token exchange failed (${response.status})`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('HF OAuth response missing access_token');
  }

  return { accessToken: payload.access_token };
}
