import { describe, expect, it, vi } from 'vitest';

import { buildHfOAuthAuthorizeUrl, exchangeHfOAuthCode } from './hfOAuth';

describe('hfOAuth', () => {
  it('builds Hugging Face authorize URL with state and scopes', () => {
    const url = buildHfOAuthAuthorizeUrl(
      {
        clientId: 'client-id',
        redirectUri: 'litertlm://oauth/hf',
        scopes: ['read-repos'],
      },
      'state-123',
    );

    expect(url).toContain('https://huggingface.co/oauth/authorize');
    expect(url).toContain('client_id=client-id');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('state=state-123');
  });

  it('exchanges authorization code for access token', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'hf_test_token' }),
    })) as unknown as typeof fetch;

    const result = await exchangeHfOAuthCode(
      'auth-code',
      { clientId: 'client-id', redirectUri: 'litertlm://oauth/hf' },
      fetchFn,
    );

    expect(result.accessToken).toBe('hf_test_token');
  });
});
