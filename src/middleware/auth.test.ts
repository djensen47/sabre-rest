import { describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../auth/types.js';
import type { SabreRequest, SabreResponse } from '../http/types.js';
import { createAuthMiddleware } from './auth.js';

const baseRequest = (): SabreRequest => ({
  method: 'GET',
  url: 'https://example.test/v1/thing',
  headers: {},
});

const okResponse = (): SabreResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  body: '{}',
});

const unauthorizedResponse = (): SabreResponse => ({
  status: 401,
  statusText: 'Unauthorized',
  headers: {},
  body: '',
});

const fakeProvider = (tokens: string[]): TokenProvider => {
  let i = 0;
  return {
    getToken: vi.fn(async () => {
      const t = tokens[i] ?? tokens[tokens.length - 1] ?? 'TOKEN';
      i = Math.min(i + 1, tokens.length);
      return t;
    }),
    invalidate: vi.fn(async () => {}),
  };
};

describe('createAuthMiddleware', () => {
  it('attaches Authorization header on the first request', async () => {
    const provider = fakeProvider(['T1']);
    const mw = createAuthMiddleware(provider);

    const next = vi.fn(async (req: SabreRequest) => {
      expect(req.headers.Authorization).toBe('Bearer T1');
      return okResponse();
    });

    const res = await mw(baseRequest(), next);
    expect(res.status).toBe(200);
    expect(provider.getToken).toHaveBeenCalledTimes(1);
    expect(provider.invalidate).not.toHaveBeenCalled();
  });

  it('refreshes and retries once on 401', async () => {
    const provider = fakeProvider(['T1', 'T2']);
    const mw = createAuthMiddleware(provider);

    let call = 0;
    const next = vi.fn(async (req: SabreRequest) => {
      call += 1;
      if (call === 1) {
        expect(req.headers.Authorization).toBe('Bearer T1');
        return unauthorizedResponse();
      }
      expect(req.headers.Authorization).toBe('Bearer T2');
      return okResponse();
    });

    const res = await mw(baseRequest(), next);
    expect(res.status).toBe(200);
    expect(provider.getToken).toHaveBeenCalledTimes(2);
    expect(provider.invalidate).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('returns the second 401 unchanged so error-mapping can handle it', async () => {
    const provider = fakeProvider(['T1', 'T2']);
    const mw = createAuthMiddleware(provider);

    const next = vi.fn(async () => unauthorizedResponse());

    const res = await mw(baseRequest(), next);
    expect(res.status).toBe(401);
    expect(provider.getToken).toHaveBeenCalledTimes(2);
    expect(provider.invalidate).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
