import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { fromSearchResponse, toSearchRequest } from './mappers.js';

describe('toSearchRequest', () => {
  const BASE_URL = 'https://api.cert.platform.sabre.com';

  it('builds a POST request with geoCode anchor', () => {
    const req = toSearchRequest(BASE_URL, {
      category: 'HOTEL',
      radius: 5,
      uom: 'KM',
      geoRef: { kind: 'geoCode', latitude: 32.877416, longitude: -96.959879 },
    });

    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v4/geo/search');
    expect(req.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    const body = JSON.parse(req.body as string);
    expect(body.GeoSearchRQ.GeoRef.Category).toBe('HOTEL');
    expect(body.GeoSearchRQ.GeoRef.Radius).toBe(5);
    expect(body.GeoSearchRQ.GeoRef.UOM).toBe('KM');
    expect(body.GeoSearchRQ.GeoRef.GeoCode).toEqual({
      Latitude: 32.877416,
      Longitude: -96.959879,
    });
  });

  it('builds a request with refPoint anchor and optional fields', () => {
    const req = toSearchRequest(BASE_URL, {
      category: 'AIR',
      radius: 10,
      uom: 'MI',
      direction: 'NE',
      maxResults: 100,
      maxSearchResults: 20,
      offset: 5,
      returnNonAggregatorPropertiesOnly: true,
      geoRef: {
        kind: 'refPoint',
        value: 'DFW',
        valueContext: 'CODE',
        refPointType: '6',
        stateProv: 'TX',
        countryCode: 'US',
        postalCode: '75038',
        cityName: 'Irving',
        codeContext: 'SABRE',
      },
      attributes: [{ name: 'CHAIN', value: 'HC' }],
    });

    const body = JSON.parse(req.body as string);
    expect(body.GeoSearchRQ.GeoRef.Direction).toBe('NE');
    expect(body.GeoSearchRQ.GeoRef.MaxResults).toBe(100);
    expect(body.GeoSearchRQ.GeoRef.MaxSearchResults).toBe(20);
    expect(body.GeoSearchRQ.GeoRef.Offset).toBe(5);
    expect(body.GeoSearchRQ.GeoRef.ReturnNonAggregatorPropertiesOnly).toBe(true);
    expect(body.GeoSearchRQ.GeoRef.RefPoint).toEqual({
      Value: 'DFW',
      ValueContext: 'CODE',
      RefPointType: '6',
      StateProv: 'TX',
      CountryCode: 'US',
      PostalCode: '75038',
      CityName: 'Irving',
      CodeContext: 'SABRE',
    });
    expect(body.GeoSearchRQ.GeoAttributes.Attributes).toEqual([{ Name: 'CHAIN', Value: 'HC' }]);
  });

  it('builds a request with addressRef anchor', () => {
    const req = toSearchRequest(BASE_URL, {
      category: 'CAR',
      radius: 2,
      uom: 'MI',
      geoRef: {
        kind: 'addressRef',
        countryCode: 'US',
        street: 'Hidden Ridge',
        city: 'Irving',
        county: 'Dallas',
        postalCode: '75038',
        stateProv: 'TX',
      },
    });

    const body = JSON.parse(req.body as string);
    expect(body.GeoSearchRQ.GeoRef.AddressRef).toEqual({
      CountryCode: 'US',
      Street: 'Hidden Ridge',
      City: 'Irving',
      County: 'Dallas',
      PostalCode: '75038',
      StateProv: 'TX',
    });
  });

  it('handles baseUrl with trailing slash', () => {
    const req = toSearchRequest('https://api.example.com/', {
      category: 'RAIL',
      radius: 1,
      uom: 'KM',
      geoRef: { kind: 'geoCode', latitude: 40.7128, longitude: -74.006 },
    });

    expect(req.url).toBe('https://api.example.com/v4/geo/search');
  });

  it('omits optional fields when not provided', () => {
    const req = toSearchRequest(BASE_URL, {
      category: 'HOTEL',
      radius: 1,
      uom: 'KM',
      geoRef: { kind: 'geoCode', latitude: 0, longitude: 0 },
    });

    const body = JSON.parse(req.body as string);
    expect(body.GeoSearchRQ.GeoRef.Direction).toBeUndefined();
    expect(body.GeoSearchRQ.GeoRef.MaxResults).toBeUndefined();
    expect(body.GeoSearchRQ.GeoRef.MaxSearchResults).toBeUndefined();
    expect(body.GeoSearchRQ.GeoRef.Offset).toBeUndefined();
    expect(body.GeoSearchRQ.GeoRef.ReturnNonAggregatorPropertiesOnly).toBeUndefined();
    expect(body.GeoSearchRQ.GeoAttributes.Attributes).toBeUndefined();
  });

  it('omits attributes when array is empty', () => {
    const req = toSearchRequest(BASE_URL, {
      category: 'HOTEL',
      radius: 1,
      uom: 'KM',
      geoRef: { kind: 'geoCode', latitude: 0, longitude: 0 },
      attributes: [],
    });

    const body = JSON.parse(req.body as string);
    expect(body.GeoSearchRQ.GeoAttributes.Attributes).toBeUndefined();
  });
});

describe('fromSearchResponse', () => {
  it('maps a populated response', () => {
    const body = JSON.stringify({
      GeoSearchRS: {
        GeoSearchResults: {
          Radius: 5,
          UOM: 'KM',
          Category: 'HOTEL',
          Latitude: 32.877416,
          Longitude: -96.959879,
          MaxSearchResults: 18,
          OffSet: 1,
          GeoSearchResult: [
            {
              Distance: 0.24,
              Direction: 'N',
              Latitude: 32.880778,
              Longitude: -96.961008,
              Name: 'MARRIOTT EXECUSTAY BEAVER CREEK',
              Id: '86034',
              Street: '1000 Meadow Creek Drive',
              Zip: '75038',
              City: 'Irvine',
              State: 'TX',
              Country: 'US',
              ConfidenceFactor: 1,
              Attributes: {
                Attribute: [{ Name: 'LOCALAREA', Id: '900011743', Value: 'Carrier' }],
              },
            },
          ],
        },
      },
    });

    const output = fromSearchResponse({ status: 200, statusText: 'OK', headers: {}, body });

    expect(output.radius).toBe(5);
    expect(output.uom).toBe('KM');
    expect(output.category).toBe('HOTEL');
    expect(output.latitude).toBe(32.877416);
    expect(output.longitude).toBe(-96.959879);
    expect(output.maxSearchResults).toBe(18);
    expect(output.offset).toBe(1);
    expect(output.results).toHaveLength(1);
    expect(output.results[0]).toEqual({
      distance: 0.24,
      direction: 'N',
      latitude: 32.880778,
      longitude: -96.961008,
      name: 'MARRIOTT EXECUSTAY BEAVER CREEK',
      id: '86034',
      street: '1000 Meadow Creek Drive',
      zip: '75038',
      city: 'Irvine',
      state: 'TX',
      country: 'US',
      confidenceFactor: 1,
      attributes: [{ name: 'LOCALAREA', id: '900011743', value: 'Carrier' }],
    });
  });

  it('maps an empty response (no results)', () => {
    const body = JSON.stringify({
      GeoSearchRS: {
        GeoSearchResults: {
          Radius: 1,
          UOM: 'MI',
          Category: 'AIR',
        },
      },
    });

    const output = fromSearchResponse({ status: 200, statusText: 'OK', headers: {}, body });
    expect(output.results).toEqual([]);
    expect(output.radius).toBe(1);
  });

  it('preserves undercooked records (missing optional fields)', () => {
    const body = JSON.stringify({
      GeoSearchRS: {
        GeoSearchResults: {
          GeoSearchResult: [{ Id: '123' }, {}],
        },
      },
    });

    const output = fromSearchResponse({ status: 200, statusText: 'OK', headers: {}, body });
    expect(output.results).toHaveLength(2);
    expect(output.results[0]).toEqual({ id: '123' });
    expect(output.results[1]).toEqual({});
  });

  it('throws SabreParseError for invalid JSON', () => {
    expect(() =>
      fromSearchResponse({ status: 200, statusText: 'OK', headers: {}, body: 'not json' }),
    ).toThrow(SabreParseError);
  });

  it('throws SabreParseError for non-object body', () => {
    expect(() =>
      fromSearchResponse({ status: 200, statusText: 'OK', headers: {}, body: '"string"' }),
    ).toThrow(SabreParseError);
  });

  it('throws SabreParseError for missing GeoSearchRS', () => {
    expect(() =>
      fromSearchResponse({ status: 200, statusText: 'OK', headers: {}, body: '{}' }),
    ).toThrow(SabreParseError);
  });
});
