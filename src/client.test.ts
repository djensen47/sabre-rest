import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from './auth/types.js';
import { createSabreClient } from './client.js';
import { SabreApiResponseError } from './errors/sabre-api-response-error.js';
import { SabreAuthenticationError } from './errors/sabre-authentication-error.js';
import type { Middleware } from './http/types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const okFetch = (body = '{}') => vi.fn().mockResolvedValue(new Response(body, { status: 200 }));

describe('createSabreClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws if baseUrl is missing', () => {
    expect(() => createSabreClient({ baseUrl: '', auth: fakeProvider() })).toThrow(/baseUrl/);
  });

  it('throws if auth is missing without overrideMiddleware', () => {
    expect(() => createSabreClient({ baseUrl: 'https://example.test' } as never)).toThrow(/auth/);
  });

  it('throws if auth is passed with overrideMiddleware: true', () => {
    expect(() =>
      createSabreClient({
        baseUrl: 'https://example.test',
        overrideMiddleware: true,
        auth: fakeProvider(),
      }),
    ).toThrow(/incompatible/);
  });

  it('issues an authenticated request through the default chain', async () => {
    const fetchMock = okFetch('{"hello":"world"}');
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://example.test',
      auth: fakeProvider(),
    });

    const res = await client.request({
      method: 'GET',
      url: 'https://example.test/v1/thing',
      headers: {},
    });

    expect(res.status).toBe(200);
    expect(res.body).toBe('{"hello":"world"}');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN');
  });

  it('maps non-2xx responses into Sabre errors via the baked-in middleware', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ errors: [{ code: 'X', message: 'no' }] }), {
          status: 400,
          statusText: 'Bad Request',
        }),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://example.test',
      auth: fakeProvider(),
    });

    await expect(
      client.request({
        method: 'GET',
        url: 'https://example.test/v1/thing',
        headers: {},
      }),
    ).rejects.toBeInstanceOf(SabreApiResponseError);
  });

  it('runs consumer middleware outermost of the baked-ins', async () => {
    vi.stubGlobal('fetch', okFetch());

    const seen: string[] = [];
    const tracer: Middleware = async (req, next) => {
      seen.push('outer-in');
      const res = await next(req);
      seen.push('outer-out');
      return res;
    };

    const client = createSabreClient({
      baseUrl: 'https://example.test',
      auth: fakeProvider(),
      middleware: [tracer],
    });

    await client.request({
      method: 'GET',
      url: 'https://example.test/v1/thing',
      headers: {},
    });

    // The tracer should see the call go out and come back. The auth header
    // is added inside the tracer (auth is innermost), so the tracer sees a
    // request without Authorization on the way in. We don't assert on that
    // here — the order assertion is enough to prove wrapping works.
    expect(seen).toEqual(['outer-in', 'outer-out']);
  });

  it('throws SabreAuthenticationError on persistent 401 (after auth middleware retry)', async () => {
    // Each call gets a fresh Response — Response bodies are streams that can
    // only be read once, and the auth middleware retries on 401.
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(
          async () => new Response('', { status: 401, statusText: 'Unauthorized' }),
        ),
    );

    const client = createSabreClient({
      baseUrl: 'https://example.test',
      auth: fakeProvider(),
    });

    await expect(
      client.request({
        method: 'GET',
        url: 'https://example.test/v1/thing',
        headers: {},
      }),
    ).rejects.toBeInstanceOf(SabreAuthenticationError);
  });

  it('overrideMiddleware bypasses baked-ins entirely', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://example.test',
      overrideMiddleware: true,
      middleware: [],
    });

    await client.request({
      method: 'GET',
      url: 'https://example.test/v1/thing',
      headers: {},
    });

    // No auth middleware was installed, so no Authorization header.
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
