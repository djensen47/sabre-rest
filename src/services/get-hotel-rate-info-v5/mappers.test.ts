import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { okResponse } from '../../http/test-utils.js';
import type { SabreResponse } from '../../http/types.js';
import { fromGetRateInfoResponse, toGetRateInfoRequest } from './mappers.js';
import type { GetHotelRateInfoInput } from './types.js';

const BASE = 'https://api.cert.platform.sabre.com';

function hotelRefInput(
  overrides: Partial<Extract<GetHotelRateInfoInput, { kind: 'hotel-ref' }>> = {},
): GetHotelRateInfoInput {
  return {
    kind: 'hotel-ref',
    hotelRef: { code: '100072188', codeContext: 'GLOBAL' },
    rateCriteria: {
      stayDateTimeRange: { startDate: '2026-06-20', endDate: '2026-06-22' },
      rooms: [{ index: 1, adults: 2 }],
    },
    ...overrides,
  };
}

function rateKeyInput(
  overrides: Partial<Extract<GetHotelRateInfoInput, { kind: 'rate-key' }>> = {},
): GetHotelRateInfoInput {
  return {
    kind: 'rate-key',
    rateKey: 'OPAQUE-RATE-KEY==',
    ...overrides,
  };
}

describe('toGetRateInfoRequest — hotel-ref flow', () => {
  it('builds a POST with the minimum body', () => {
    const req = toGetRateInfoRequest(BASE, hotelRefInput());

    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v5/get/hotelrateinfo');
    expect(req.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(req.body ?? '')).toEqual({
      GetHotelRateInfoRQ: {
        version: '5.0.0',
        HotelRefs: { HotelRef: { HotelCode: '100072188', CodeContext: 'GLOBAL' } },
        RateInfoRef: {
          StayDateTimeRange: { StartDate: '2026-06-20', EndDate: '2026-06-22' },
          Rooms: { Room: [{ Index: 1, Adults: 2 }] },
        },
      },
    });
  });

  it('handles a trailing-slash base URL without duplicating it', () => {
    const req = toGetRateInfoRequest(`${BASE}/`, hotelRefInput());
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v5/get/hotelrateinfo');
  });

  it('omits optional codeContext when not supplied', () => {
    const req = toGetRateInfoRequest(BASE, hotelRefInput({ hotelRef: { code: '8315' } }));
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelRateInfoRQ.HotelRefs.HotelRef).toEqual({ HotelCode: '8315' });
  });

  it('attaches POS and corporateNumber when supplied', () => {
    const req = toGetRateInfoRequest(
      BASE,
      hotelRefInput({
        pointOfSale: { pseudoCityCode: 'TM61' },
        corporateNumber: 'DK44391RC',
      }),
    );
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelRateInfoRQ.POS).toEqual({ Source: { PseudoCityCode: 'TM61' } });
    expect(body.GetHotelRateInfoRQ.CorporateNumber).toBe('DK44391RC');
  });

  it('joins childAges with commas on the wire', () => {
    const req = toGetRateInfoRequest(
      BASE,
      hotelRefInput({
        rateCriteria: {
          stayDateTimeRange: { startDate: '2026-06-20', endDate: '2026-06-22' },
          rooms: [{ index: 1, adults: 2, children: 3, childAges: [10, 11, 12] }],
        },
      }),
    );
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelRateInfoRQ.RateInfoRef.Rooms.Room[0]).toEqual({
      Index: 1,
      Adults: 2,
      Children: 3,
      ChildAges: '10,11,12',
    });
  });

  it('joins rateSource array with commas', () => {
    const req = toGetRateInfoRequest(
      BASE,
      hotelRefInput({
        rateCriteria: {
          stayDateTimeRange: { startDate: '2026-06-20', endDate: '2026-06-22' },
          rooms: [{ index: 1, adults: 2 }],
          rateSource: ['100', '112', '110'],
        },
      }),
    );
    expect(JSON.parse(req.body ?? '').GetHotelRateInfoRQ.RateInfoRef.RateSource).toBe(
      '100,112,110',
    );
  });

  it('omits documented defaults when the consumer does not supply them', () => {
    const req = toGetRateInfoRequest(BASE, hotelRefInput());
    const rir = JSON.parse(req.body ?? '').GetHotelRateInfoRQ.RateInfoRef;
    expect(rir.PrepaidQualifier).toBeUndefined();
    expect(rir.RefundableOnly).toBeUndefined();
    expect(rir.ConvertedRateInfoOnly).toBeUndefined();
    expect(rir.SortBy).toBeUndefined();
    expect(rir.ShowNegotiatedRatesFirst).toBeUndefined();
  });

  it('emits a full rate criteria body when supplied', () => {
    const req = toGetRateInfoRequest(
      BASE,
      hotelRefInput({
        rateCriteria: {
          stayDateTimeRange: { startDate: '2026-06-20', endDate: '2026-06-22' },
          rooms: [{ index: 1, adults: 2 }],
          currencyCode: 'USD',
          prepaidQualifier: 'IncludePrepaid',
          refundableOnly: true,
          convertedRateInfoOnly: true,
          travellerCountry: 'IN',
          languageCode: 'EN',
          showNegotiatedRatesFirst: true,
          rateRange: { min: 100, max: 500 },
          ratePlanCandidates: {
            exactMatchOnly: false,
            candidates: [{ ratePlanType: '11', ratePlanCode: 'ABC' }],
          },
          loyaltyIds: ['YX1123'],
          rateFilters: [{ type: 'Commission', value: 'NC', action: 'Exclude' }],
          sortOrder: 'ASC',
          sortBy: 'AverageNightlyRateBeforeTax',
        },
      }),
    );
    const rir = JSON.parse(req.body ?? '').GetHotelRateInfoRQ.RateInfoRef;
    expect(rir).toMatchObject({
      CurrencyCode: 'USD',
      PrepaidQualifier: 'IncludePrepaid',
      RefundableOnly: true,
      ConvertedRateInfoOnly: true,
      TravellerCountry: 'IN',
      LanguageCode: 'EN',
      ShowNegotiatedRatesFirst: true,
      RateRange: { Min: 100, Max: 500 },
      RatePlanCandidates: {
        ExactMatchOnly: false,
        RatePlanCandidate: [{ RatePlanType: '11', RatePlanCode: 'ABC' }],
      },
      LoyaltyIds: { LoyaltyId: ['YX1123'] },
      RateFilters: { RateFilter: [{ Type: 'Commission', Value: 'NC', Action: 'Exclude' }] },
      SortOrder: 'ASC',
      SortBy: 'AverageNightlyRateBeforeTax',
    });
  });
});

describe('toGetRateInfoRequest — rate-key flow', () => {
  it('builds a POST with only the rate key', () => {
    const req = toGetRateInfoRequest(BASE, rateKeyInput());
    expect(JSON.parse(req.body ?? '')).toEqual({
      GetHotelRateInfoRQ: { version: '5.0.0', RateKeyRef: { RateKey: 'OPAQUE-RATE-KEY==' } },
    });
  });

  it('does not emit HotelRefs or RateInfoRef on the rate-key flow', () => {
    const req = toGetRateInfoRequest(BASE, rateKeyInput());
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelRateInfoRQ.HotelRefs).toBeUndefined();
    expect(body.GetHotelRateInfoRQ.RateInfoRef).toBeUndefined();
  });

  it('passes through all optional refinement fields', () => {
    const req = toGetRateInfoRequest(
      BASE,
      rateKeyInput({
        pointOfSale: { pseudoCityCode: 'TM61' },
        prepaidQualifier: 'PrepaidOnly',
        refundableOnly: true,
        convertedRateInfoOnly: false,
        exactMatchOnly: true,
        travellerCountry: 'US',
        shopKey: 'SHOP-KEY==',
        rateRange: { min: 50 },
        roomSetTypes: ['RoomView', 'RoomType'],
        rateSource: ['100', '112'],
      }),
    );
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelRateInfoRQ.POS).toEqual({ Source: { PseudoCityCode: 'TM61' } });
    expect(body.GetHotelRateInfoRQ.RateKeyRef).toEqual({
      RateKey: 'OPAQUE-RATE-KEY==',
      PrepaidQualifier: 'PrepaidOnly',
      RefundableOnly: true,
      ConvertedRateInfoOnly: false,
      ExactMatchOnly: true,
      TravellerCountry: 'US',
      ShopKey: 'SHOP-KEY==',
      RateRange: { Min: 50 },
      RoomSetTypes: { RoomSet: [{ Type: 'RoomView' }, { Type: 'RoomType' }] },
      RateSource: '100,112',
    });
  });
});

describe('fromGetRateInfoResponse', () => {
  it('maps a populated ResponseWithRooms body', () => {
    const out = fromGetRateInfoResponse(
      okResponse({
        GetHotelRateInfoRS: {
          ApplicationResults: { status: 'Complete' },
          HotelRateInfos: {
            HotelRateInfo: {
              HotelInfo: {
                HotelCode: '100072188',
                CodeContext: 'GLOBAL',
                SabreHotelCode: '8315',
                ChainCode: 'HY',
              },
              RateInfos: {
                ShopKey: 'SHOP==',
                ConvertedRateInfo: [
                  {
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
              Rooms: {
                Room: [
                  {
                    RoomIndex: 1,
                    RoomType: 'Suite',
                    RatePlans: {
                      RatePlan: [
                        {
                          PrepaidIndicator: false,
                          RateSource: '100',
                          RateKey: 'RATEPLAN-KEY==',
                          RatePlanName: 'Single Bed Room',
                        },
                      ],
                    },
                  },
                ],
              },
              LanguageCode: 'EN',
            },
          },
        },
      }),
    );

    expect(out.status).toBe('Complete');
    expect(out.applicationResults).toEqual({ status: 'Complete' });
    expect(out.hotel?.info).toEqual({
      code: '100072188',
      codeContext: 'GLOBAL',
      sabreCode: '8315',
      chainCode: 'HY',
    });
    expect(out.hotel?.rateInfos?.shopKey).toBe('SHOP==');
    expect(out.hotel?.rateInfos?.rateInfo?.[0]?.rateKey).toBe('RATEKEY-NATIVE==');
    expect(out.hotel?.rateInfos?.convertedRateInfo?.[0]?.rateKey).toBe('RATEKEY-CONV==');
    expect(out.hotel?.rooms).toHaveLength(1);
    expect(out.hotel?.rooms?.[0]?.ratePlans?.[0]?.rateKey).toBe('RATEPLAN-KEY==');
    expect(out.hotel?.languageCode).toBe('EN');
    expect(out.hotel?.roomSets).toBeUndefined();
  });

  it('maps a populated ResponseWithRoomSets body', () => {
    const out = fromGetRateInfoResponse(
      okResponse({
        GetHotelRateInfoRS: {
          HotelRateInfos: {
            HotelRateInfo: {
              HotelInfo: { HotelCode: 'A', CodeContext: 'GLOBAL' },
              RateInfos: {},
              RoomSets: {
                RoomSet: [
                  {
                    RoomSetAttributes: {
                      RoomSetAttribute: [{ Type: 'RoomType', Code: 3, Value: 'Suite' }],
                    },
                    Room: [
                      {
                        RoomIndex: 1,
                        RatePlans: {
                          RatePlan: [
                            {
                              PrepaidIndicator: true,
                              RateSource: '112',
                              RateKey: 'RPKEY==',
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      }),
    );

    expect(out.hotel?.roomSets).toHaveLength(1);
    expect(out.hotel?.roomSets?.[0]?.attributes).toEqual([
      { type: 'RoomType', code: 3, value: 'Suite' },
    ]);
    expect(out.hotel?.roomSets?.[0]?.rooms?.[0]?.ratePlans?.[0]?.rateKey).toBe('RPKEY==');
    expect(out.hotel?.rooms).toBeUndefined();
    expect(out.hotel?.languageCode).toBeUndefined();
  });

  it('maps alternate hotels and rate unavailability', () => {
    const out = fromGetRateInfoResponse(
      okResponse({
        GetHotelRateInfoRS: {
          HotelRateInfos: {
            HotelRateInfo: {
              HotelInfo: { HotelCode: 'A', CodeContext: 'GLOBAL' },
              RateInfos: {},
              AlternateHotelInfos: {
                AlternateHotelInfo: [
                  { HotelCode: '100097634', CodeContext: 'GLOBAL', ChainCode: 'MC' },
                ],
              },
              RateUnavailability: {
                RateSource: [
                  { Source: '110', Reason: 'timeout' },
                  { Source: '112', Reason: 'no-avail', DisplayMessage: 'no rooms' },
                ],
              },
            },
          },
        },
      }),
    );

    expect(out.hotel?.alternateHotels).toEqual([
      { code: '100097634', codeContext: 'GLOBAL', chainCode: 'MC' },
    ]);
    expect(out.hotel?.rateUnavailability).toEqual([
      { source: '110', reason: 'timeout' },
      { source: '112', reason: 'no-avail', displayMessage: 'no rooms' },
    ]);
  });

  it('returns an empty output envelope when GetHotelRateInfoRS is empty', () => {
    const out = fromGetRateInfoResponse(okResponse({ GetHotelRateInfoRS: {} }));
    expect(out).toEqual({});
  });

  it('throws SabreParseError on non-JSON body', () => {
    const res: SabreResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '<html>not json</html>',
    };
    try {
      fromGetRateInfoResponse(res);
      expect.fail('expected SabreParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(SabreParseError);
      expect((err as SabreParseError).responseBody).toBe('<html>not json</html>');
    }
  });

  it('throws SabreParseError when body is JSON but not an object', () => {
    expect(() => fromGetRateInfoResponse(okResponse(null))).toThrow(SabreParseError);
  });

  it('throws SabreParseError when GetHotelRateInfoRS is missing', () => {
    expect(() => fromGetRateInfoResponse(okResponse({}))).toThrow(SabreParseError);
  });
});
