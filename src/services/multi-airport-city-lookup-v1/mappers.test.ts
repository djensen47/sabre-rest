import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { SabreResponse } from '../../http/types.js';
import { fromLookupCitiesResponse, toLookupCitiesRequest } from './mappers.js';

const okResponse = (body: unknown): SabreResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('toLookupCitiesRequest', () => {
  it('builds a GET to the cities path with no query params when no input is given', () => {
    const req = toLookupCitiesRequest('https://api.cert.platform.sabre.com');
    expect(req.method).toBe('GET');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/lists/supported/cities');
    expect(req.headers.Accept).toBe('application/json');
  });

  it('omits the country param when input is an empty object', () => {
    const req = toLookupCitiesRequest('https://api.cert.platform.sabre.com', {});
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/lists/supported/cities');
  });

  it('appends the country query param when a country code is supplied', () => {
    const req = toLookupCitiesRequest('https://api.cert.platform.sabre.com', { country: 'DE' });
    expect(req.url).toBe(
      'https://api.cert.platform.sabre.com/v1/lists/supported/cities?country=DE',
    );
  });

  it('handles a base URL with a trailing slash', () => {
    const req = toLookupCitiesRequest('https://api.cert.platform.sabre.com/', { country: 'US' });
    expect(req.url).toBe(
      'https://api.cert.platform.sabre.com/v1/lists/supported/cities?country=US',
    );
  });
});

describe('fromLookupCitiesResponse', () => {
  it('maps a populated response into the public output shape', () => {
    const out = fromLookupCitiesResponse(
      okResponse({
        Cities: [
          {
            code: 'BER',
            name: 'Berlin',
            countryCode: 'DE',
            countryName: 'Germany',
            regionName: 'Europe',
            Links: [
              {
                rel: 'airportsInCity',
                href: 'https://api.cert.platform.sabre.com/v1/lists/supported/cities/BER/airports',
              },
            ],
          },
          {
            code: 'NYC',
            name: 'New York',
            countryCode: 'US',
            countryName: 'United States',
            regionName: 'North America',
          },
        ],
      }),
    );

    expect(out.cities).toEqual([
      {
        code: 'BER',
        name: 'Berlin',
        countryCode: 'DE',
        countryName: 'Germany',
        regionName: 'Europe',
        links: [
          {
            rel: 'airportsInCity',
            href: 'https://api.cert.platform.sabre.com/v1/lists/supported/cities/BER/airports',
          },
        ],
      },
      {
        code: 'NYC',
        name: 'New York',
        countryCode: 'US',
        countryName: 'United States',
        regionName: 'North America',
      },
    ]);
  });

  it('returns an empty list when Cities is missing', () => {
    const out = fromLookupCitiesResponse(okResponse({}));
    expect(out.cities).toEqual([]);
  });

  it('returns an empty list when Cities is an empty array', () => {
    const out = fromLookupCitiesResponse(okResponse({ Cities: [] }));
    expect(out.cities).toEqual([]);
  });

  it('preserves every city Sabre returned, including ones with missing fields', () => {
    const out = fromLookupCitiesResponse(
      okResponse({
        Cities: [
          { code: 'BER', name: 'Berlin' },
          { code: 'NYC' }, // missing name and other fields
          { name: 'No Code' }, // missing code
          {}, // all fields missing
        ],
      }),
    );

    expect(out.cities).toEqual([
      { code: 'BER', name: 'Berlin' },
      { code: 'NYC' },
      { name: 'No Code' },
      {},
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
      fromLookupCitiesResponse(res);
      expect.fail('expected SabreParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(SabreParseError);
      expect((err as SabreParseError).responseBody).toBe('<html>not json</html>');
    }
  });

  it('throws SabreParseError when the body is JSON but not an object', () => {
    expect(() => fromLookupCitiesResponse(okResponse(null))).toThrow(SabreParseError);
  });
});
