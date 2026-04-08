import { describe, expect, it } from 'vitest';
import { SabreApiResponseError } from '../errors/sabre-api-response-error.js';
import { SabreAuthenticationError } from '../errors/sabre-authentication-error.js';
import type { SabreRequest, SabreResponse } from '../http/types.js';
import { createErrorMappingMiddleware } from './error-mapping.js';

const req: SabreRequest = {
  method: 'GET',
  url: 'https://example.test/v1/thing',
  headers: {},
};

const respond = (overrides: Partial<SabreResponse>): SabreResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  body: '',
  ...overrides,
});

describe('createErrorMappingMiddleware', () => {
  it('passes 2xx responses through unchanged', async () => {
    const mw = createErrorMappingMiddleware();
    const res = await mw(req, async () => respond({ status: 200, body: '{"ok":true}' }));
    expect(res.status).toBe(200);
    expect(res.body).toBe('{"ok":true}');
  });

  it('throws SabreAuthenticationError on 401', async () => {
    const mw = createErrorMappingMiddleware();
    await expect(
      mw(req, async () => respond({ status: 401, statusText: 'Unauthorized' })),
    ).rejects.toMatchObject({
      name: 'SabreAuthenticationError',
      statusCode: 401,
    });
  });

  it('throws SabreAuthenticationError on 403', async () => {
    const mw = createErrorMappingMiddleware();
    await expect(
      mw(req, async () => respond({ status: 403, statusText: 'Forbidden' })),
    ).rejects.toBeInstanceOf(SabreAuthenticationError);
  });

  it('throws SabreApiResponseError on other non-2xx with parsed body', async () => {
    const body = { errors: [{ code: 'X', message: 'nope' }] };
    const mw = createErrorMappingMiddleware();

    try {
      await mw(req, async () =>
        respond({ status: 400, statusText: 'Bad Request', body: JSON.stringify(body) }),
      );
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SabreApiResponseError);
      const sErr = err as SabreApiResponseError;
      expect(sErr.statusCode).toBe(400);
      expect(sErr.responseBody).toEqual(body);
    }
  });

  it('throws SabreApiResponseError on non-2xx with non-JSON body and exposes raw string', async () => {
    const mw = createErrorMappingMiddleware();
    try {
      await mw(req, async () => respond({ status: 500, statusText: 'Server Error', body: 'oops' }));
      expect.fail('expected throw');
    } catch (err) {
      const sErr = err as SabreApiResponseError;
      expect(sErr.statusCode).toBe(500);
      expect(sErr.responseBody).toBe('oops');
    }
  });
});
