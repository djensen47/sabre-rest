import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { SabreResponse } from '../../http/types.js';
import { fromLookupResponse, toLookupRequest } from './mappers.js';

const okResponse = (body: unknown): SabreResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('toLookupRequest', () => {
  it('builds a GET to the airlines path with no query params when no codes are given', () => {
    const req = toLookupRequest('https://api.cert.platform.sabre.com');
    expect(req.method).toBe('GET');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/lists/utilities/airlines');
    expect(req.headers.Accept).toBe('application/json');
  });

  it('omits the airlinecode param when codes is an empty array', () => {
    const req = toLookupRequest('https://api.cert.platform.sabre.com', { codes: [] });
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/lists/utilities/airlines');
  });

  it('joins multiple codes with commas in the airlinecode query param', () => {
    const req = toLookupRequest('https://api.cert.platform.sabre.com', {
      codes: ['A5', 'C8', 'E4'],
    });
    expect(req.url).toBe(
      'https://api.cert.platform.sabre.com/v1/lists/utilities/airlines?airlinecode=A5%2CC8%2CE4',
    );
  });

  it('handles a base URL with a trailing slash', () => {
    const req = toLookupRequest('https://api.cert.platform.sabre.com/', { codes: ['AA'] });
    expect(req.url).toBe(
      'https://api.cert.platform.sabre.com/v1/lists/utilities/airlines?airlinecode=AA',
    );
  });
});

describe('fromLookupResponse', () => {
  it('maps a populated response into the public output shape', () => {
    const out = fromLookupResponse(
      okResponse({
        AirlineInfo: [
          {
            AirlineCode: 'AI',
            AirlineName: 'Air India Limited',
            AlternativeBusinessName: 'Air India',
          },
          {
            AirlineCode: 'AA',
            AirlineName: 'American Airlines, Inc.',
          },
        ],
      }),
    );

    expect(out.airlines).toEqual([
      { code: 'AI', name: 'Air India Limited', alternativeName: 'Air India' },
      { code: 'AA', name: 'American Airlines, Inc.' },
    ]);
  });

  it('returns an empty list when AirlineInfo is missing', () => {
    const out = fromLookupResponse(okResponse({}));
    expect(out.airlines).toEqual([]);
  });

  it('preserves every airline Sabre returned, including ones with missing fields', () => {
    const out = fromLookupResponse(
      okResponse({
        AirlineInfo: [
          { AirlineCode: 'AI', AirlineName: 'Air India Limited' },
          { AirlineCode: 'X1' }, // missing name
          { AirlineName: 'No Code' }, // missing code
          {}, // missing both
          { AirlineCode: 'BA', AirlineName: 'British Airways' },
        ],
      }),
    );

    expect(out.airlines).toEqual([
      { code: 'AI', name: 'Air India Limited' },
      { code: 'X1' },
      { name: 'No Code' },
      {},
      { code: 'BA', name: 'British Airways' },
    ]);
  });

  it('throws SabreParseError when the body is not valid JSON', () => {
    const res: SabreResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '<html>not json</html>',
    };

    try {
      fromLookupResponse(res);
      expect.fail('expected SabreParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(SabreParseError);
      expect((err as SabreParseError).responseBody).toBe('<html>not json</html>');
    }
  });

  it('throws SabreParseError when the body is JSON but not an object', () => {
    expect(() => fromLookupResponse(okResponse(null))).toThrow(SabreParseError);
  });
});
