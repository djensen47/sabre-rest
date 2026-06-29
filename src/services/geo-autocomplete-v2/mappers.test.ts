import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { fromAutocompleteResponse, toAutocompleteRequest } from './mappers.js';

describe('toAutocompleteRequest', () => {
  const BASE_URL = 'https://api.cert.platform.sabre.com';

  it('builds a GET request with required query param', () => {
    const req = toAutocompleteRequest(BASE_URL, { query: 'Dall' });

    expect(req.method).toBe('GET');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v2/geo/autocomplete?query=Dall');
    expect(req.headers).toEqual({ Accept: 'application/json' });
    expect(req.body).toBeUndefined();
  });

  it('includes all optional query params', () => {
    const req = toAutocompleteRequest(BASE_URL, {
      query: 'London',
      category: 'AIR',
      limit: 10,
      clientId: 'myapp',
    });

    const url = new URL(req.url);
    expect(url.searchParams.get('query')).toBe('London');
    expect(url.searchParams.get('category')).toBe('AIR');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('clientId')).toBe('myapp');
  });

  it('omits optional params when not provided', () => {
    const req = toAutocompleteRequest(BASE_URL, { query: 'Par' });

    const url = new URL(req.url);
    expect(url.searchParams.get('query')).toBe('Par');
    expect(url.searchParams.has('category')).toBe(false);
    expect(url.searchParams.has('limit')).toBe(false);
    expect(url.searchParams.has('clientId')).toBe(false);
  });

  it('handles baseUrl with trailing slash', () => {
    const req = toAutocompleteRequest('https://api.example.com/', { query: 'NYC' });
    expect(req.url).toBe('https://api.example.com/v2/geo/autocomplete?query=NYC');
  });

  it('percent-encodes special characters in query', () => {
    const req = toAutocompleteRequest(BASE_URL, { query: 'New York' });
    expect(req.url).toContain('query=New+York');
  });
});

describe('fromAutocompleteResponse', () => {
  it('maps a populated response with multiple categories', () => {
    const body = JSON.stringify({
      responseHeader: { status: 0, QTime: 4 },
      grouped: {
        'category:AIR': {
          matches: 181,
          doclist: {
            numFound: 2,
            start: 0,
            docs: [
              {
                name: 'Dallas/Fort Worth Intl.',
                city: 'Dallas',
                country: 'US',
                countryName: 'United States Of America',
                stateName: 'Texas',
                state: 'TX',
                category: 'AIR',
                id: 'DFW',
                dataset: 'AIR',
                datasource: 'INNOVATA',
                confidenceFactor: '1',
                latitude: '32.896111',
                longitude: '-97.041111',
                iataCityCode: 'QDF',
                ranking: 884,
              },
            ],
          },
        },
        'category:CITY': {
          matches: 50,
          doclist: {
            numFound: 1,
            start: 0,
            docs: [
              {
                name: 'Dallas',
                city: 'Dallas',
                country: 'US',
                id: 'DFW',
                category: 'CITY',
              },
            ],
          },
        },
      },
    });

    const output = fromAutocompleteResponse({ status: 200, statusText: 'OK', headers: {}, body });

    expect(output.status).toBe(0);
    expect(output.queryTime).toBe(4);
    expect(output.groups).toHaveLength(2);

    const airGroup = output.groups.at(0);
    expect(airGroup?.category).toBe('AIR');
    expect(airGroup?.matches).toBe(181);
    expect(airGroup?.numFound).toBe(2);
    expect(airGroup?.start).toBe(0);
    expect(airGroup?.places).toHaveLength(1);
    expect(airGroup?.places[0]).toEqual({
      name: 'Dallas/Fort Worth Intl.',
      city: 'Dallas',
      country: 'US',
      countryName: 'United States Of America',
      stateName: 'Texas',
      state: 'TX',
      category: 'AIR',
      id: 'DFW',
      dataset: 'AIR',
      datasource: 'INNOVATA',
      confidenceFactor: '1',
      latitude: '32.896111',
      longitude: '-97.041111',
      iataCityCode: 'QDF',
      ranking: 884,
    });

    const cityGroup = output.groups.at(1);
    expect(cityGroup?.category).toBe('CITY');
    expect(cityGroup?.matches).toBe(50);
  });

  it('handles the spec typo categpry:LOCATION', () => {
    const body = JSON.stringify({
      grouped: {
        'categpry:LOCATION': {
          matches: 5,
          doclist: {
            numFound: 1,
            start: 0,
            docs: [{ name: 'Some Location', id: 'LOC1' }],
          },
        },
      },
    });

    const output = fromAutocompleteResponse({ status: 200, statusText: 'OK', headers: {}, body });
    expect(output.groups).toHaveLength(1);
    const locGroup = output.groups.at(0);
    expect(locGroup?.category).toBe('LOCATION');
    expect(locGroup?.places[0]?.name).toBe('Some Location');
  });

  it('maps an empty response (no grouped categories)', () => {
    const body = JSON.stringify({ responseHeader: { status: 0 } });

    const output = fromAutocompleteResponse({ status: 200, statusText: 'OK', headers: {}, body });
    expect(output.groups).toEqual([]);
    expect(output.status).toBe(0);
  });

  it('maps a response with empty doclist', () => {
    const body = JSON.stringify({
      grouped: {
        'category:AIR': {
          matches: 0,
          doclist: { numFound: 0, start: 0, docs: [] },
        },
      },
    });

    const output = fromAutocompleteResponse({ status: 200, statusText: 'OK', headers: {}, body });
    expect(output.groups).toHaveLength(1);
    expect(output.groups.at(0)?.places).toEqual([]);
  });

  it('preserves undercooked places (missing optional fields)', () => {
    const body = JSON.stringify({
      grouped: {
        'category:POI': {
          matches: 1,
          doclist: { numFound: 1, start: 0, docs: [{ id: 'X' }] },
        },
      },
    });

    const output = fromAutocompleteResponse({ status: 200, statusText: 'OK', headers: {}, body });
    expect(output.groups.at(0)?.places[0]).toEqual({ id: 'X' });
  });

  it('throws SabreParseError for invalid JSON', () => {
    expect(() =>
      fromAutocompleteResponse({ status: 200, statusText: 'OK', headers: {}, body: 'not json' }),
    ).toThrow(SabreParseError);
  });

  it('throws SabreParseError for non-object body', () => {
    expect(() =>
      fromAutocompleteResponse({ status: 200, statusText: 'OK', headers: {}, body: '42' }),
    ).toThrow(SabreParseError);
  });
});
