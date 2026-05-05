import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { okResponse } from '../../http/test-utils.js';
import type { SabreResponse } from '../../http/types.js';
import { fromGetAvailResponse, toGetAvailRequest } from './mappers.js';
import type { GetHotelAvailInput } from './types.js';

const BASE = 'https://api.cert.platform.sabre.com';

function geoInput(overrides: Partial<GetHotelAvailInput> = {}): GetHotelAvailInput {
  return {
    search: {
      kind: 'geo',
      geoRef: {
        kind: 'geoCode',
        radius: 25,
        uom: 'MI',
        latitude: 32.758,
        longitude: -97.08,
      },
    },
    rateInfoRef: {
      currencyCode: 'USD',
      bestOnly: '1',
      stayDateTimeRange: { startDate: '2026-06-20', endDate: '2026-06-22' },
      rooms: [{ index: 1, adults: 2 }],
    },
    ...overrides,
  };
}

describe('toGetAvailRequest', () => {
  it('builds a POST with the minimum geo body', () => {
    const req = toGetAvailRequest(BASE, geoInput());

    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v5/get/hotelavail');
    expect(req.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(req.body ?? '')).toEqual({
      GetHotelAvailRQ: {
        SearchCriteria: {
          GeoSearch: {
            GeoRef: {
              Radius: 25,
              UOM: 'MI',
              GeoCode: { Latitude: 32.758, Longitude: -97.08 },
            },
          },
          RateInfoRef: {
            CurrencyCode: 'USD',
            BestOnly: '1',
            StayDateTimeRange: { StartDate: '2026-06-20', EndDate: '2026-06-22' },
            Rooms: { Room: [{ Index: 1, Adults: 2 }] },
          },
        },
      },
    });
  });

  it('handles a trailing-slash base URL without duplicating it', () => {
    const req = toGetAvailRequest(`${BASE}/`, geoInput());
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v5/get/hotelavail');
  });

  it('emits a RefPoint GeoRef with optional disambiguators', () => {
    const req = toGetAvailRequest(BASE, {
      ...geoInput(),
      search: {
        kind: 'geo',
        geoRef: {
          kind: 'refPoint',
          radius: 5,
          uom: 'KM',
          restrictToCountry: 'US',
          refPointType: '6',
          value: 'DFW',
          valueContext: 'CODE',
          stateProv: 'TX',
          countryCode: 'US',
        },
      },
    });
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelAvailRQ.SearchCriteria.GeoSearch.GeoRef).toEqual({
      Radius: 5,
      UOM: 'KM',
      RestrictSearchToCountry: 'US',
      RefPoint: {
        RefPointType: '6',
        Value: 'DFW',
        ValueContext: 'CODE',
        StateProv: 'TX',
        CountryCode: 'US',
      },
    });
  });

  it('emits an AddressRef GeoRef with only required country code', () => {
    const req = toGetAvailRequest(BASE, {
      ...geoInput(),
      search: {
        kind: 'geo',
        geoRef: { kind: 'addressRef', radius: 5, uom: 'MI', countryCode: 'US' },
      },
    });
    expect(JSON.parse(req.body ?? '').GetHotelAvailRQ.SearchCriteria.GeoSearch.GeoRef).toEqual({
      Radius: 5,
      UOM: 'MI',
      AddressRef: { CountryCode: 'US' },
    });
  });

  it('emits HotelRefs search body', () => {
    const req = toGetAvailRequest(BASE, {
      ...geoInput(),
      search: {
        kind: 'hotels',
        hotels: [{ code: '100072188', codeContext: 'GLOBAL' }, { code: '8315' }],
      },
    });
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelAvailRQ.SearchCriteria.HotelRefs).toEqual({
      HotelRef: [{ HotelCode: '100072188', CodeContext: 'GLOBAL' }, { HotelCode: '8315' }],
    });
    expect(body.GetHotelAvailRQ.SearchCriteria.GeoSearch).toBeUndefined();
  });

  it('joins childAges with commas on the wire', () => {
    const req = toGetAvailRequest(BASE, {
      ...geoInput(),
      rateInfoRef: {
        ...geoInput().rateInfoRef,
        rooms: [{ index: 1, adults: 2, children: 3, childAges: [10, 11, 12] }],
      },
    });
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelAvailRQ.SearchCriteria.RateInfoRef.Rooms.Room[0]).toEqual({
      Index: 1,
      Adults: 2,
      Children: 3,
      ChildAges: '10,11,12',
    });
  });

  it('joins rateSource array with commas', () => {
    const req = toGetAvailRequest(BASE, {
      ...geoInput(),
      rateInfoRef: { ...geoInput().rateInfoRef, rateSource: ['100', '112', '110'] },
    });
    expect(JSON.parse(req.body ?? '').GetHotelAvailRQ.SearchCriteria.RateInfoRef.RateSource).toBe(
      '100,112,110',
    );
  });

  it('omits documented defaults when the consumer does not supply them', () => {
    const req = toGetAvailRequest(BASE, geoInput());
    const sc = JSON.parse(req.body ?? '').GetHotelAvailRQ.SearchCriteria;
    expect(sc.OffSet).toBeUndefined();
    expect(sc.SortBy).toBeUndefined();
    expect(sc.PageSize).toBeUndefined();
    expect(sc.TierLabels).toBeUndefined();
    expect(sc.RateDetailsInd).toBeUndefined();
    expect(sc.RateInfoRef.PrepaidQualifier).toBeUndefined();
    expect(sc.RateInfoRef.RefundableOnly).toBeUndefined();
    expect(sc.RateInfoRef.ConvertedRateInfoOnly).toBeUndefined();
  });

  it('attaches POS + CorporateNumber when supplied', () => {
    const req = toGetAvailRequest(BASE, {
      ...geoInput(),
      pointOfSale: { pseudoCityCode: 'TM61' },
      corporateNumber: 'DK44391RC',
    });
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelAvailRQ.POS).toEqual({ Source: { PseudoCityCode: 'TM61' } });
    expect(body.GetHotelAvailRQ.CorporateNumber).toBe('DK44391RC');
  });

  it('attaches hotelPref filters and imageRef when supplied', () => {
    const req = toGetAvailRequest(BASE, {
      ...geoInput(),
      hotelPref: {
        lenientHotelName: 'inn and',
        chainCodes: ['HY'],
        amenityCodes: { codes: [5], inclusive: true },
        sabreRating: { min: '3.0', max: '5.0' },
      },
      imageRef: { type: 'MEDIUM', languageCode: 'EN' },
    });
    const sc = JSON.parse(req.body ?? '').GetHotelAvailRQ.SearchCriteria;
    expect(sc.HotelPref).toEqual({
      LenientHotelName: 'inn and',
      ChainCodes: { ChainCode: ['HY'] },
      AmenityCodes: { AmenityCode: [5], Inclusive: true },
      SabreRating: { Min: '3.0', Max: '5.0' },
    });
    expect(sc.ImageRef).toEqual({ Type: 'MEDIUM', LanguageCode: 'EN' });
  });

  it('passes through sort + paging + tierLabels when supplied', () => {
    const req = toGetAvailRequest(BASE, {
      ...geoInput(),
      criteria: {
        offSet: 2,
        sortBy: 'AverageNightlyRate',
        sortOrder: 'ASC',
        pageSize: 50,
        tierLabels: false,
      },
    });
    const sc = JSON.parse(req.body ?? '').GetHotelAvailRQ.SearchCriteria;
    expect(sc.OffSet).toBe(2);
    expect(sc.SortBy).toBe('AverageNightlyRate');
    expect(sc.SortOrder).toBe('ASC');
    expect(sc.PageSize).toBe(50);
    expect(sc.TierLabels).toBe(false);
  });
});

describe('fromGetAvailResponse', () => {
  it('maps a populated response with hotels, paging metadata, and rate keys', () => {
    const out = fromGetAvailResponse(
      okResponse({
        GetHotelAvailRS: {
          ApplicationResults: { status: 'Complete' },
          HotelAvailInfos: {
            OffSet: 1,
            MaxSearchResults: 163,
            ShopKey: 'lwsf8wzmk0',
            SearchLatitude: 32.758,
            SearchLongitude: -97.08,
            HotelAvailInfo: [
              {
                HotelInfo: {
                  HotelCode: '100074506',
                  CodeContext: 'GLOBAL',
                  HotelName: 'Baymont Inn',
                  ChainCode: 'BU',
                  Distance: 0.89,
                  Direction: 'E',
                  UOM: 'MI',
                  SabreRating: '2.5',
                },
                HotelRateInfo: {
                  RateInfos: {
                    ConvertedRateInfo: [
                      {
                        StartDate: '2026-06-20',
                        EndDate: '2026-06-22',
                        AmountAfterTax: '136.66',
                        CurrencyCode: 'USD',
                        RateSource: '110',
                        RateKey: 'RATEKEY-CONV==',
                      },
                    ],
                    RateInfo: [
                      {
                        AmountAfterTax: '110.50',
                        CurrencyCode: 'USD',
                        RateSource: '100',
                        RateKey: 'RATEKEY-NATIVE==',
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      }),
    );

    expect(out.maxSearchResults).toBe(163);
    expect(out.shopKey).toBe('lwsf8wzmk0');
    expect(out.searchLatitude).toBe(32.758);
    expect(out.applicationResults).toEqual({ status: 'Complete' });
    expect(out.hotels).toHaveLength(1);
    const h = out.hotels[0];
    expect(h).toMatchObject({
      code: '100074506',
      codeContext: 'GLOBAL',
      name: 'Baymont Inn',
      chainCode: 'BU',
      distance: 0.89,
      distanceUnit: 'MI',
    });
    expect(h?.rateInfo?.rateInfo?.[0]?.rateKey).toBe('RATEKEY-NATIVE==');
    expect(h?.rateInfo?.convertedRateInfo?.[0]?.rateKey).toBe('RATEKEY-CONV==');
    expect(h?.rateInfo?.convertedRateInfo?.[0]?.rateSource).toBe('110');
  });

  it('returns an empty hotels list when HotelAvailInfos is missing', () => {
    const out = fromGetAvailResponse(okResponse({ GetHotelAvailRS: {} }));
    expect(out.hotels).toEqual([]);
  });

  it('returns an empty hotels list when HotelAvailInfo is empty', () => {
    const out = fromGetAvailResponse(
      okResponse({
        GetHotelAvailRS: { HotelAvailInfos: { HotelAvailInfo: [] } },
      }),
    );
    expect(out.hotels).toEqual([]);
  });

  it('preserves hotels with only required fields (no rateInfo)', () => {
    const out = fromGetAvailResponse(
      okResponse({
        GetHotelAvailRS: {
          HotelAvailInfos: {
            HotelAvailInfo: [
              { HotelInfo: { HotelCode: 'A', CodeContext: 'GLOBAL' } },
              { HotelInfo: { HotelCode: 'B', CodeContext: 'GLOBAL', HotelName: 'B' } },
            ],
          },
        },
      }),
    );
    expect(out.hotels).toEqual([
      { code: 'A', codeContext: 'GLOBAL' },
      { code: 'B', codeContext: 'GLOBAL', name: 'B' },
    ]);
  });

  it('surfaces RateUnavailability branch', () => {
    const out = fromGetAvailResponse(
      okResponse({
        GetHotelAvailRS: {
          HotelAvailInfos: {
            HotelAvailInfo: [
              {
                HotelInfo: { HotelCode: 'X', CodeContext: 'GLOBAL' },
                HotelRateInfo: {
                  RateUnavailability: {
                    RateSource: [
                      { Source: '110', Reason: 'timeout' },
                      { Source: '112', Reason: 'no-avail', DisplayMessage: 'no rooms' },
                    ],
                  },
                },
              },
            ],
          },
        },
      }),
    );
    expect(out.hotels[0]?.rateInfo?.unavailability?.sources).toEqual([
      { source: '110', reason: 'timeout' },
      { source: '112', reason: 'no-avail', displayMessage: 'no rooms' },
    ]);
  });

  it('preserves rate entries that are missing the optional rateKey', () => {
    // Per the OAS, RateInfo.RateKey is optional; mapper must not drop records.
    const out = fromGetAvailResponse(
      okResponse({
        GetHotelAvailRS: {
          HotelAvailInfos: {
            HotelAvailInfo: [
              {
                HotelInfo: { HotelCode: 'A', CodeContext: 'GLOBAL' },
                HotelRateInfo: {
                  RateInfos: {
                    RateInfo: [{ RateSource: '100', AmountAfterTax: '100.00' }],
                  },
                },
              },
            ],
          },
        },
      }),
    );
    expect(out.hotels[0]?.rateInfo?.rateInfo?.[0]?.rateKey).toBeUndefined();
    expect(out.hotels[0]?.rateInfo?.rateInfo?.[0]?.rateSource).toBe('100');
  });

  it('throws SabreParseError on non-JSON body', () => {
    const res: SabreResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '<html>not json</html>',
    };
    try {
      fromGetAvailResponse(res);
      expect.fail('expected SabreParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(SabreParseError);
      expect((err as SabreParseError).responseBody).toBe('<html>not json</html>');
    }
  });

  it('throws SabreParseError when body is JSON but not an object', () => {
    expect(() => fromGetAvailResponse(okResponse(null))).toThrow(SabreParseError);
  });

  it('throws SabreParseError when GetHotelAvailRS is missing', () => {
    expect(() => fromGetAvailResponse(okResponse({}))).toThrow(SabreParseError);
  });
});
