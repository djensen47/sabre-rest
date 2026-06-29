import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { okResponse } from '../../http/test-utils.js';
import type { SabreResponse } from '../../http/types.js';
import { fromAutocompleteResponse, toAutocompleteRequest } from './mappers.js';

describe('toAutocompleteRequest', () => {
  it('builds a GET to the geo autocomplete path with the query param', () => {
    const req = toAutocompleteRequest('https://api.cert.platform.sabre.com', {
      query: 'Dall',
    });
    expect(req.method).toBe('GET');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v2/geo/autocomplete?query=Dall');
    expect(req.headers.Accept).toBe('application/json');
  });

  it('handles a base URL with a trailing slash', () => {
    const req = toAutocompleteRequest('https://api.cert.platform.sabre.com/', {
      query: 'Dall',
    });
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v2/geo/autocomplete?query=Dall');
  });

  it('includes category when provided', () => {
    const req = toAutocompleteRequest('https://api.cert.platform.sabre.com', {
      query: 'Dall',
      category: 'AIR',
    });
    expect(req.url).toBe(
      'https://api.cert.platform.sabre.com/v2/geo/autocomplete?query=Dall&category=AIR',
    );
  });

  it('includes limit when provided', () => {
    const req = toAutocompleteRequest('https://api.cert.platform.sabre.com', {
      query: 'Dall',
      limit: 10,
    });
    expect(req.url).toBe(
      'https://api.cert.platform.sabre.com/v2/geo/autocomplete?query=Dall&limit=10',
    );
  });

  it('includes clientId when provided', () => {
    const req = toAutocompleteRequest('https://api.cert.platform.sabre.com', {
      query: 'Dall',
      clientId: 'devstudio',
    });
    expect(req.url).toBe(
      'https://api.cert.platform.sabre.com/v2/geo/autocomplete?query=Dall&clientId=devstudio',
    );
  });

  it('includes all optional params when all are provided', () => {
    const req = toAutocompleteRequest('https://api.cert.platform.sabre.com', {
      query: 'London',
      category: 'CITY',
      limit: 3,
      clientId: 'myapp',
    });
    expect(req.url).toBe(
      'https://api.cert.platform.sabre.com/v2/geo/autocomplete?query=London&category=CITY&limit=3&clientId=myapp',
    );
  });

  it('percent-encodes the query parameter', () => {
    const req = toAutocompleteRequest('https://api.cert.platform.sabre.com', {
      query: 'New York',
    });
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v2/geo/autocomplete?query=New+York');
  });
});

describe('fromAutocompleteResponse', () => {
  it('maps a populated response with multiple categories', () => {
    const out = fromAutocompleteResponse(
      okResponse({
        responseHeader: { status: 0, QTime: 4 },
        grouped: {
          'category:AIR': {
            matches: 181,
            doclist: {
              numFound: 2,
              start: 0,
              docs: [
                {
                  id: 'DFW',
                  name: 'Dallas/Fort Worth Intl.',
                  city: 'Dallas',
                  state: 'TX',
                  stateName: 'Texas',
                  country: 'US',
                  countryName: 'United States Of America',
                  category: 'AIR',
                  latitude: '32.896111',
                  longitude: '-97.041111',
                  iataCityCode: 'QDF',
                  ranking: 884,
                  dataset: 'AIR',
                  datasource: 'INNOVATA',
                  confidenceFactor: '1',
                },
                {
                  id: 'DAL',
                  name: 'Dallas Love Field',
                  city: 'Dallas',
                  country: 'US',
                  category: 'AIR',
                },
              ],
            },
          },
          'category:CITY': {
            matches: 5,
            doclist: {
              numFound: 1,
              start: 0,
              docs: [
                {
                  id: 'DFW',
                  name: 'Dallas',
                  city: 'Dallas',
                  country: 'US',
                  category: 'CITY',
                },
              ],
            },
          },
        },
      }),
    );

    expect(out.groups).toHaveLength(2);

    const airGroup = out.groups[0];
    expect(airGroup?.category).toBe('AIR');
    expect(airGroup?.totalMatches).toBe(181);
    expect(airGroup?.places).toHaveLength(2);
    expect(airGroup?.places[0]).toEqual({
      id: 'DFW',
      name: 'Dallas/Fort Worth Intl.',
      city: 'Dallas',
      state: 'TX',
      stateName: 'Texas',
      country: 'US',
      countryName: 'United States Of America',
      category: 'AIR',
      latitude: '32.896111',
      longitude: '-97.041111',
      iataCityCode: 'QDF',
      ranking: 884,
      dataset: 'AIR',
      datasource: 'INNOVATA',
      confidenceFactor: '1',
    });
    expect(airGroup?.places[1]).toEqual({
      id: 'DAL',
      name: 'Dallas Love Field',
      city: 'Dallas',
      country: 'US',
      category: 'AIR',
    });

    const cityGroup = out.groups[1];
    expect(cityGroup?.category).toBe('CITY');
    expect(cityGroup?.totalMatches).toBe(5);
    expect(cityGroup?.places).toHaveLength(1);
  });

  it('handles the Sabre typo categpry:LOCATION key', () => {
    const out = fromAutocompleteResponse(
      okResponse({
        grouped: {
          'categpry:LOCATION': {
            matches: 3,
            doclist: {
              numFound: 1,
              start: 0,
              docs: [{ id: 'LOC1', name: 'Some Location', category: 'LOCATION' }],
            },
          },
        },
      }),
    );

    expect(out.groups).toHaveLength(1);
    expect(out.groups[0]?.category).toBe('LOCATION');
    expect(out.groups[0]?.places).toHaveLength(1);
    expect(out.groups[0]?.places[0]?.id).toBe('LOC1');
  });

  it('returns an empty groups array when grouped is missing', () => {
    const out = fromAutocompleteResponse(okResponse({}));
    expect(out.groups).toEqual([]);
  });

  it('returns an empty places array when doclist is missing', () => {
    const out = fromAutocompleteResponse(
      okResponse({
        grouped: {
          'category:AIR': { matches: 0 },
        },
      }),
    );

    expect(out.groups).toHaveLength(1);
    expect(out.groups[0]?.places).toEqual([]);
  });

  it('preserves every place Sabre returned, including ones with missing fields', () => {
    const out = fromAutocompleteResponse(
      okResponse({
        grouped: {
          'category:AIR': {
            doclist: {
              docs: [
                { id: 'DFW', name: 'Dallas/Fort Worth Intl.' },
                { id: 'X1' },
                { name: 'No Id' },
                {},
                { id: 'LHR', name: 'London Heathrow' },
              ],
            },
          },
        },
      }),
    );

    expect(out.groups[0]?.places).toEqual([
      { id: 'DFW', name: 'Dallas/Fort Worth Intl.' },
      { id: 'X1' },
      { name: 'No Id' },
      {},
      { id: 'LHR', name: 'London Heathrow' },
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
      fromAutocompleteResponse(res);
      expect.fail('expected SabreParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(SabreParseError);
      expect((err as SabreParseError).responseBody).toBe('<html>not json</html>');
    }
  });

  it('throws SabreParseError when the body is JSON but not an object', () => {
    expect(() => fromAutocompleteResponse(okResponse(null))).toThrow(SabreParseError);
  });
});
