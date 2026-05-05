import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { okResponse } from '../../http/test-utils.js';
import type { SabreResponse } from '../../http/types.js';
import { fromSearchResponse, toSearchRequest } from './mappers.js';
import type { SearchHotelsInput } from './types.js';

const BASE = 'https://api.cert.platform.sabre.com';

function withGeoCode(overrides: Partial<SearchHotelsInput> = {}): SearchHotelsInput {
  return {
    geoSearch: {
      geoRef: { kind: 'geoCode', radius: 25, uom: 'MI', latitude: 32.758, longitude: -97.08 },
    },
    ...overrides,
  };
}

describe('toSearchRequest', () => {
  it('builds a POST to the hotel search path with the minimum body', () => {
    const req = toSearchRequest(BASE, withGeoCode());

    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v2.0.0/hotel/search');
    expect(req.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(req.body ?? '')).toEqual({
      HotelSearchRQ: {
        SearchCriteria: {
          GeoSearch: {
            GeoRef: {
              Radius: 25,
              UOM: 'MI',
              GeoCode: { Latitude: 32.758, Longitude: -97.08 },
            },
          },
        },
      },
    });
  });

  it('handles a base URL with a trailing slash without duplicating it', () => {
    const req = toSearchRequest(`${BASE}/`, withGeoCode());
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v2.0.0/hotel/search');
  });

  it('emits a RefPoint GeoRef with optional disambiguators', () => {
    const req = toSearchRequest(BASE, {
      geoSearch: {
        geoRef: {
          kind: 'refPoint',
          radius: 10,
          uom: 'KM',
          refPointType: '6',
          value: 'DFW',
          valueContext: 'CODE',
          stateProv: 'TX',
          countryCode: 'US',
        },
      },
    });
    const body = JSON.parse(req.body ?? '');
    expect(body.HotelSearchRQ.SearchCriteria.GeoSearch.GeoRef).toEqual({
      Radius: 10,
      UOM: 'KM',
      RefPoint: {
        RefPointType: '6',
        Value: 'DFW',
        ValueContext: 'CODE',
        StateProv: 'TX',
        CountryCode: 'US',
      },
    });
  });

  it('emits an AddressRef GeoRef with only the required country code', () => {
    const req = toSearchRequest(BASE, {
      geoSearch: {
        geoRef: { kind: 'addressRef', radius: 5, uom: 'MI', countryCode: 'US' },
      },
    });
    const body = JSON.parse(req.body ?? '');
    expect(body.HotelSearchRQ.SearchCriteria.GeoSearch.GeoRef).toEqual({
      Radius: 5,
      UOM: 'MI',
      AddressRef: { CountryCode: 'US' },
    });
  });

  it('omits optional sort / tierLabels / pos / hotelPref / imageRef when not supplied', () => {
    const req = toSearchRequest(BASE, withGeoCode());
    const body = JSON.parse(req.body ?? '');
    expect(body.HotelSearchRQ.POS).toBeUndefined();
    expect(body.HotelSearchRQ.SearchCriteria.SortBy).toBeUndefined();
    expect(body.HotelSearchRQ.SearchCriteria.SortOrder).toBeUndefined();
    expect(body.HotelSearchRQ.SearchCriteria.TierLabels).toBeUndefined();
    expect(body.HotelSearchRQ.SearchCriteria.HotelPref).toBeUndefined();
    expect(body.HotelSearchRQ.SearchCriteria.ImageRef).toBeUndefined();
  });

  it('sends POS.Source.PseudoCityCode when pos is supplied', () => {
    const req = toSearchRequest(BASE, withGeoCode({ pos: { pseudoCityCode: 'TM61' } }));
    const body = JSON.parse(req.body ?? '');
    expect(body.HotelSearchRQ.POS).toEqual({ Source: { PseudoCityCode: 'TM61' } });
  });

  it('omits Inclusive when the consumer did not supply it, and sends it when they did', () => {
    const withoutInclusive = toSearchRequest(
      BASE,
      withGeoCode({ hotelPref: { amenityCodes: { codes: [15, 16] } } }),
    );
    const body1 = JSON.parse(withoutInclusive.body ?? '');
    expect(body1.HotelSearchRQ.SearchCriteria.HotelPref.AmenityCodes).toEqual({
      AmenityCode: [15, 16],
    });

    const withInclusive = toSearchRequest(
      BASE,
      withGeoCode({ hotelPref: { amenityCodes: { codes: [15, 16], inclusive: true } } }),
    );
    const body2 = JSON.parse(withInclusive.body ?? '');
    expect(body2.HotelSearchRQ.SearchCriteria.HotelPref.AmenityCodes).toEqual({
      AmenityCode: [15, 16],
      Inclusive: true,
    });
  });

  it('sends all hotelPref filter groups under their OAS names', () => {
    const req = toSearchRequest(
      BASE,
      withGeoCode({
        hotelPref: {
          hotelName: 'Inn',
          brandCodes: ['10008'],
          chainCodes: ['MC'],
          amenityCodes: { codes: [5] },
          securityFeatureCodes: { codes: [15] },
          propertyTypeCodes: { codes: [1] },
          propertyQualityCodes: { codes: [2] },
          sabreRating: { min: '2.0', max: '5.0' },
        },
      }),
    );
    const hotelPref = JSON.parse(req.body ?? '').HotelSearchRQ.SearchCriteria.HotelPref;
    expect(hotelPref).toEqual({
      HotelName: 'Inn',
      BrandCodes: { BrandCode: ['10008'] },
      ChainCodes: { ChainCode: ['MC'] },
      AmenityCodes: { AmenityCode: [5] },
      SecurityFeatureCodes: { SecurityFeatureCode: [15] },
      PropertyTypeCodes: { PropertyTypeCode: [1] },
      PropertyQualityCodes: { PropertyQualityCode: [2] },
      SabreRating: { Min: '2.0', Max: '5.0' },
    });
  });

  it('passes through sort preferences and tier labels when supplied', () => {
    const req = toSearchRequest(
      BASE,
      withGeoCode({
        maxResults: 50,
        sortBy: 'SabreRating',
        sortOrder: 'DESC',
        tierLabels: false,
      }),
    );
    const sc = JSON.parse(req.body ?? '').HotelSearchRQ.SearchCriteria;
    expect(sc.MaxResults).toBe(50);
    expect(sc.SortBy).toBe('SabreRating');
    expect(sc.SortOrder).toBe('DESC');
    expect(sc.TierLabels).toBe(false);
  });

  it('sends GeoAttributes only when attributes is non-empty', () => {
    const empty = toSearchRequest(BASE, withGeoCode({ geoSearch: { ...withGeoCode().geoSearch } }));
    expect(
      JSON.parse(empty.body ?? '').HotelSearchRQ.SearchCriteria.GeoSearch.GeoAttributes,
    ).toBeUndefined();

    const withAttrs = toSearchRequest(BASE, {
      geoSearch: {
        ...withGeoCode().geoSearch,
        attributes: [{ name: 'LOCALAREA', value: 'KRAKOW AREA' }],
      },
    });
    expect(
      JSON.parse(withAttrs.body ?? '').HotelSearchRQ.SearchCriteria.GeoSearch.GeoAttributes,
    ).toEqual({
      Attributes: [{ Name: 'LOCALAREA', Value: 'KRAKOW AREA' }],
    });
  });
});

describe('fromSearchResponse', () => {
  it('maps a populated response with hotels, anchor coords, and envelope', () => {
    const out = fromSearchResponse(
      okResponse({
        HotelSearchRS: {
          ApplicationResults: { status: 'Complete' },
          HotelSearchInfos: {
            MaxSearchResults: 763,
            SearchLatitude: 32.758,
            SearchLongitude: -97.08,
            HotelSearchInfo: [
              {
                HotelInfo: {
                  HotelCode: '100072188',
                  CodeContext: 'GLOBAL',
                  SabreHotelCode: '8315',
                  HotelName: 'Hyatt Regency Tulsa',
                  ChainCode: 'HY',
                  Distance: 23.45,
                  Direction: 'S',
                  UOM: 'MI',
                  LocationInfo: {
                    Latitude: '36.154800',
                    Longitude: '-95.990356',
                    Address: {
                      AddressLine1: '50 N MARTINGALE RD',
                      CityName: { CityCode: 'TUL', value: 'Tulsa' },
                      StateProv: { StateCode: 'OK', value: 'Oklahoma' },
                      PostalCode: '60173',
                      CountryName: { Code: 'US', value: 'United States' },
                    },
                    Contact: { Phone: '999-222-1111' },
                  },
                  Amenities: {
                    Amenity: [{ Code: 5, Description: 'Parking', ComplimentaryInd: false }],
                  },
                },
              },
            ],
          },
        },
      }),
    );

    expect(out.maxSearchResults).toBe(763);
    expect(out.searchLatitude).toBe(32.758);
    expect(out.searchLongitude).toBe(-97.08);
    expect(out.applicationResults).toEqual({ status: 'Complete' });
    expect(out.hotels).toHaveLength(1);
    const h = out.hotels[0];
    expect(h).toMatchObject({
      code: '100072188',
      codeContext: 'GLOBAL',
      sabreCode: '8315',
      name: 'Hyatt Regency Tulsa',
      chainCode: 'HY',
      distance: 23.45,
      direction: 'S',
      distanceUnit: 'MI',
    });
    expect(h?.location?.address?.city).toEqual({ code: 'TUL', name: 'Tulsa' });
    expect(h?.location?.contact).toEqual({ phone: '999-222-1111' });
    expect(h?.amenities).toEqual([{ code: 5, description: 'Parking', complimentary: false }]);
  });

  it('returns an empty hotels list when HotelSearchInfos is missing', () => {
    const out = fromSearchResponse(okResponse({ HotelSearchRS: {} }));
    expect(out.hotels).toEqual([]);
    expect(out.maxSearchResults).toBeUndefined();
  });

  it('returns an empty hotels list when HotelSearchInfo is an empty array', () => {
    const out = fromSearchResponse(
      okResponse({ HotelSearchRS: { HotelSearchInfos: { HotelSearchInfo: [] } } }),
    );
    expect(out.hotels).toEqual([]);
  });

  it('preserves every hotel Sabre returned, including ones with only required fields', () => {
    const out = fromSearchResponse(
      okResponse({
        HotelSearchRS: {
          HotelSearchInfos: {
            HotelSearchInfo: [
              { HotelInfo: { HotelCode: 'A', CodeContext: 'GLOBAL' } },
              { HotelInfo: { HotelCode: 'B', CodeContext: 'SABRE', HotelName: 'B Hotel' } },
            ],
          },
        },
      }),
    );
    expect(out.hotels).toEqual([
      { code: 'A', codeContext: 'GLOBAL' },
      { code: 'B', codeContext: 'SABRE', name: 'B Hotel' },
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
      fromSearchResponse(res);
      expect.fail('expected SabreParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(SabreParseError);
      expect((err as SabreParseError).responseBody).toBe('<html>not json</html>');
    }
  });

  it('throws SabreParseError when the body is JSON but not an object', () => {
    expect(() => fromSearchResponse(okResponse(null))).toThrow(SabreParseError);
  });

  it('throws SabreParseError when HotelSearchRS is missing', () => {
    expect(() => fromSearchResponse(okResponse({}))).toThrow(SabreParseError);
  });
});
