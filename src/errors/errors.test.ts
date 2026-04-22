import { describe, expect, it } from 'vitest';
import {
  SabreApiResponseError,
  SabreAuthenticationError,
  SabreBookingErrorResponseError,
  SabreError,
  SabreNetworkError,
  SabreParseError,
  SabreTimeoutError,
} from './index.js';

describe('SabreError', () => {
  it('extends Error', () => {
    const err = new SabreError('boom');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SabreError);
    expect(err.message).toBe('boom');
    expect(err.name).toBe('SabreError');
  });

  it('preserves cause', () => {
    const cause = new TypeError('underlying');
    const err = new SabreError('wrapped', { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('SabreApiResponseError', () => {
  it('carries statusCode and responseBody', () => {
    const body = { errors: [{ code: 'X', message: 'nope' }] };
    const err = new SabreApiResponseError('Sabre rejected the request', 400, body);
    expect(err).toBeInstanceOf(SabreError);
    expect(err.statusCode).toBe(400);
    expect(err.responseBody).toBe(body);
    expect(err.name).toBe('SabreApiResponseError');
  });

  it('responseBody is optional', () => {
    const err = new SabreApiResponseError('boom', 500);
    expect(err.responseBody).toBeUndefined();
  });
});

describe('SabreAuthenticationError', () => {
  it('carries optional statusCode', () => {
    const err = new SabreAuthenticationError('bad creds', 401);
    expect(err).toBeInstanceOf(SabreError);
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe('SabreAuthenticationError');
  });

  it('statusCode is optional', () => {
    const err = new SabreAuthenticationError('network down');
    expect(err.statusCode).toBeUndefined();
  });

  it('preserves cause for wrapped network failures', () => {
    const cause = new SabreNetworkError('connection refused');
    const err = new SabreAuthenticationError('Failed to obtain token', undefined, { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('SabreNetworkError', () => {
  it('extends SabreError', () => {
    const err = new SabreNetworkError('DNS failure');
    expect(err).toBeInstanceOf(SabreError);
    expect(err.name).toBe('SabreNetworkError');
  });
});

describe('SabreTimeoutError', () => {
  it('extends SabreError', () => {
    const err = new SabreTimeoutError('deadline exceeded');
    expect(err).toBeInstanceOf(SabreError);
    expect(err.name).toBe('SabreTimeoutError');
  });
});

describe('SabreParseError', () => {
  it('carries optional responseBody', () => {
    const err = new SabreParseError('invalid json', 'not-json');
    expect(err).toBeInstanceOf(SabreError);
    expect(err.responseBody).toBe('not-json');
    expect(err.name).toBe('SabreParseError');
  });
});

describe('SabreBookingErrorResponseError', () => {
  it('carries the errors array and summarises them in the message', () => {
    const err = new SabreBookingErrorResponseError([
      { category: 'APPLICATION_ERROR', type: 'TIMEOUT' },
      { category: 'BAD_REQUEST', type: 'VALIDATION_ERROR' },
    ]);
    expect(err).toBeInstanceOf(SabreError);
    expect(err.name).toBe('SabreBookingErrorResponseError');
    expect(err.errors).toHaveLength(2);
    expect(err.message).toContain('APPLICATION_ERROR/TIMEOUT');
    expect(err.message).toContain('BAD_REQUEST/VALIDATION_ERROR');
  });

  it('preserves cause', () => {
    const cause = new Error('underlying');
    const err = new SabreBookingErrorResponseError([{ category: 'BAD_REQUEST', type: 'X' }], {
      cause,
    });
    expect(err.cause).toBe(cause);
  });
});
