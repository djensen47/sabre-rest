import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SabreAuthenticationError } from '../errors/sabre-authentication-error.js';
import { createMemoryTokenStore } from './memory-store.js';
import { createOAuthV2 } from './oauth-v2.js';

const baseOpts = () => ({
  baseUrl: 'https://api.cert.platform.sabre.com',
  clientId: 'id',
  clientSecret: 'secret',
});

const tokenResponse = (overrides: Partial<{ access_token: string; expires_in: number }> = {}) =>
  new Response(
    JSON.stringify({
      access_token: 'TOKEN',
      token_type: 'bearer',
      expires_in: 604800,
      ...overrides,
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );

describe('createOAuthV2', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches a token from the v2 endpoint and caches it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse());
    vi.stubGlobal('fetch', fetchMock);

    const provider = createOAuthV2(baseOpts());
    const token = await provider.getToken();

    expect(token).toBe('TOKEN');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v2/auth/token');
    const headers = (init as RequestInit).headers as Record<string, string>;
    // Sabre uses non-standard double base64 encoding for the Authorization
    // header: base64( base64(clientId) + ':' + base64(secret) ). Standard
    // HTTP Basic (single base64) returns 401 from the v2 token endpoint.
    const expectedEncoded = Buffer.from(
      `${Buffer.from('id').toString('base64')}:${Buffer.from('secret').toString('base64')}`,
    ).toString('base64');
    expect(headers.Authorization).toBe(`Basic ${expectedEncoded}`);
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect((init as RequestInit).body).toBe('grant_type=client_credentials');

    // Second call should hit the cache, not fetch.
    const token2 = await provider.getToken();
    expect(token2).toBe('TOKEN');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes when the cached token is past expiry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse({ access_token: 'OLD', expires_in: 1 }))
      .mockResolvedValueOnce(tokenResponse({ access_token: 'NEW', expires_in: 604800 }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = createOAuthV2({ ...baseOpts(), expirySkewMs: 0 });
    const t1 = await provider.getToken();
    expect(t1).toBe('OLD');

    // Make the cached token look expired.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const t2 = await provider.getToken();
    expect(t2).toBe('NEW');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('invalidate forces the next getToken to refresh', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse({ access_token: 'A' }))
      .mockResolvedValueOnce(tokenResponse({ access_token: 'B' }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = createOAuthV2(baseOpts());
    expect(await provider.getToken()).toBe('A');
    await provider.invalidate();
    expect(await provider.getToken()).toBe('B');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serializes concurrent refresh attempts (single-flight)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse({ access_token: 'ONCE' }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = createOAuthV2(baseOpts());
    const [a, b, c] = await Promise.all([
      provider.getToken(),
      provider.getToken(),
      provider.getToken(),
    ]);

    expect(a).toBe('ONCE');
    expect(b).toBe('ONCE');
    expect(c).toBe('ONCE');
    // Only one network call despite three concurrent callers.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws SabreAuthenticationError on a non-2xx token response and includes the response body in the message', async () => {
    const errorBody = JSON.stringify({
      error: 'invalid_client',
      error_description: 'Credentials are incorrect',
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(errorBody, { status: 401, statusText: 'Unauthorized' })),
    );

    // Single getToken() call: Response bodies are streams that can only be
    // read once, and mockResolvedValue returns the same Response instance
    // each call. Assert everything on the one error we get.
    const provider = createOAuthV2(baseOpts());
    let caught: unknown;
    try {
      await provider.getToken();
      expect.fail('expected SabreAuthenticationError');
    } catch (err) {
      caught = err;
    }
    expect(caught).toMatchObject({
      name: 'SabreAuthenticationError',
      statusCode: 401,
    });
    const message = (caught as Error).message;
    expect(message).toContain('401');
    expect(message).toContain('Unauthorized');
    // The body must be surfaced — without it consumers cannot tell why
    // auth failed (invalid_client vs. expired secret vs. wrong base URL).
    expect(message).toContain('invalid_client');
    expect(message).toContain('Credentials are incorrect');
  });

  it('omits the body suffix when the non-2xx token response has an empty body', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('', { status: 503, statusText: 'Service Unavailable' })),
    );

    const provider = createOAuthV2(baseOpts());
    try {
      await provider.getToken();
      expect.fail('expected SabreAuthenticationError');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('503');
      expect(message).toContain('Service Unavailable');
      // No trailing colon-and-junk when there's no body to attach.
      expect(message).not.toMatch(/:\s*$/);
    }
  });

  it('wraps a network failure in SabreAuthenticationError with cause', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed: ECONNREFUSED')));

    const provider = createOAuthV2(baseOpts());
    await expect(provider.getToken()).rejects.toBeInstanceOf(SabreAuthenticationError);
  });

  it('uses a custom store', async () => {
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse());
    vi.stubGlobal('fetch', fetchMock);

    const store = createMemoryTokenStore();
    const setSpy = vi.spyOn(store, 'set');

    const provider = createOAuthV2({ ...baseOpts(), store });
    await provider.getToken();

    expect(setSpy).toHaveBeenCalledTimes(1);
  });
});
