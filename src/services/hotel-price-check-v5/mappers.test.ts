import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { okResponse } from '../../http/test-utils.js';
import type { SabreResponse } from '../../http/types.js';
import { fromCheckResponse, toCheckRequest } from './mappers.js';

const BASE = 'https://api.cert.platform.sabre.com';
const RATE_KEY = 'OPAQUE==';

describe('toCheckRequest', () => {
  it('builds a POST with the minimum body (rateKey only)', () => {
    const req = toCheckRequest(BASE, { rateKey: RATE_KEY });

    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v5/hotel/pricecheck');
    expect(req.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(req.body ?? '')).toEqual({
      HotelPriceCheckRQ: {
        RateInfoRef: { RateKey: RATE_KEY },
      },
    });
  });

  it('handles a base URL with a trailing slash without duplicating it', () => {
    const req = toCheckRequest(`${BASE}/`, { rateKey: RATE_KEY });
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v5/hotel/pricecheck');
  });

  it('attaches POS.Source.PseudoCityCode when pointOfSale is supplied', () => {
    const req = toCheckRequest(BASE, {
      rateKey: RATE_KEY,
      pointOfSale: { pseudoCityCode: 'TM61' },
    });
    const body = JSON.parse(req.body ?? '');
    expect(body.HotelPriceCheckRQ.POS).toEqual({ Source: { PseudoCityCode: 'TM61' } });
  });

  it('attaches CorporateNumber when supplied', () => {
    const req = toCheckRequest(BASE, { rateKey: RATE_KEY, corporateNumber: 'DK44391RC' });
    const body = JSON.parse(req.body ?? '');
    expect(body.HotelPriceCheckRQ.CorporateNumber).toBe('DK44391RC');
  });

  it('emits StayDateTimeRange when stay is supplied', () => {
    const req = toCheckRequest(BASE, {
      rateKey: RATE_KEY,
      stay: { startDate: '2024-06-20', endDate: '2024-06-21' },
    });
    const body = JSON.parse(req.body ?? '');
    expect(body.HotelPriceCheckRQ.RateInfoRef.StayDateTimeRange).toEqual({
      StartDate: '2024-06-20',
      EndDate: '2024-06-21',
    });
  });

  it('joins childAges with commas on the wire', () => {
    const req = toCheckRequest(BASE, {
      rateKey: RATE_KEY,
      rooms: [{ index: 1, adults: 2, children: 3, childAges: [10, 11, 12] }],
    });
    const body = JSON.parse(req.body ?? '');
    expect(body.HotelPriceCheckRQ.RateInfoRef.Rooms).toEqual({
      Room: [{ Index: 1, Adults: 2, Children: 3, ChildAges: '10,11,12' }],
    });
  });

  it('omits ChildAges when the array is empty', () => {
    const req = toCheckRequest(BASE, {
      rateKey: RATE_KEY,
      rooms: [{ index: 1, adults: 1, children: 0, childAges: [] }],
    });
    const body = JSON.parse(req.body ?? '');
    expect(body.HotelPriceCheckRQ.RateInfoRef.Rooms.Room[0]).toEqual({
      Index: 1,
      Adults: 1,
      Children: 0,
    });
  });

  it('omits Rooms entirely when rooms is absent or empty', () => {
    const empty = toCheckRequest(BASE, { rateKey: RATE_KEY, rooms: [] });
    expect(JSON.parse(empty.body ?? '').HotelPriceCheckRQ.RateInfoRef.Rooms).toBeUndefined();
    const none = toCheckRequest(BASE, { rateKey: RATE_KEY });
    expect(JSON.parse(none.body ?? '').HotelPriceCheckRQ.RateInfoRef.Rooms).toBeUndefined();
  });
});

describe('fromCheckResponse', () => {
  it('maps a populated response with bookingKey, price fields, hotel, and a room rate plan', () => {
    const out = fromCheckResponse(
      okResponse({
        HotelPriceCheckRS: {
          ApplicationResults: { status: 'Complete' },
          PriceCheckInfo: {
            BookingKey: 'BK-123',
            PriceChange: true,
            PriceDifference: '12.02',
            CurrencyCode: 'AUD',
            ConvertedPriceChange: false,
            ConvertedPriceDifference: '8.00',
            ConvertedCurrencyCode: 'USD',
            HotelInfo: {
              HotelCode: '100072188',
              CodeContext: 'GLOBAL',
              HotelName: 'Hyatt Regency Tulsa',
              ChainCode: 'HY',
              LocationInfo: {
                Latitude: '36.15',
                Address: {
                  AddressLine1: '100 E 2nd St',
                  CityName: { CityCode: 'TUL', value: 'Tulsa' },
                  CountryName: { Code: 'US', value: 'United States' },
                },
              },
            },
            HotelRateInfo: {
              RateInfos: {
                RateInfo: [
                  {
                    RateSource: '100',
                    RateKey: 'NEWKEY==',
                    CurrencyCode: 'AUD',
                    AmountAfterTax: '1023.12',
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
                          RatePlanName: 'Single Bed Room',
                          PrepaidIndicator: true,
                          RateSource: '100',
                          RateKey: 'NEWKEY==',
                          RateInfo: {
                            CurrencyCode: 'AUD',
                            AmountAfterTax: '1023.12',
                            CancelPenalties: {
                              CancelPenalty: [{ Refundable: true }],
                            },
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      }),
    );

    expect(out.bookingKey).toBe('BK-123');
    expect(out.priceChange).toBe(true);
    expect(out.priceDifference).toBe('12.02');
    expect(out.currencyCode).toBe('AUD');
    expect(out.convertedPriceChange).toBe(false);
    expect(out.convertedCurrencyCode).toBe('USD');
    expect(out.hotel).toMatchObject({
      code: '100072188',
      codeContext: 'GLOBAL',
      name: 'Hyatt Regency Tulsa',
      chainCode: 'HY',
    });
    expect(out.hotel?.location?.address?.city).toEqual({ code: 'TUL', name: 'Tulsa' });
    expect(out.rateInfo?.rateInfos).toHaveLength(1);
    expect(out.rateInfo?.rateInfos?.[0]).toMatchObject({ rateSource: '100', rateKey: 'NEWKEY==' });
    expect(out.rateInfo?.rooms).toHaveLength(1);
    expect(out.rateInfo?.rooms?.[0]?.ratePlans).toHaveLength(1);
    expect(out.rateInfo?.rooms?.[0]?.ratePlans?.[0]).toMatchObject({
      prepaidIndicator: true,
      rateSource: '100',
      rateKey: 'NEWKEY==',
    });
    expect(out.rateInfo?.rooms?.[0]?.ratePlans?.[0]?.rateInfo?.cancelPenalties).toEqual([
      { refundable: true },
    ]);
    expect(out.applicationResults).toEqual({ status: 'Complete' });
  });

  it('returns diagnostics-only output when PriceCheckInfo is absent', () => {
    const out = fromCheckResponse(
      okResponse({
        HotelPriceCheckRS: {
          ApplicationResults: {
            status: 'Incomplete',
            Error: [{ type: 'Application', timeStamp: '2025-01-01T00:00:00Z' }],
          },
        },
      }),
    );
    expect(out.bookingKey).toBeUndefined();
    expect(out.applicationResults?.status).toBe('Incomplete');
    expect(out.applicationResults?.errors).toEqual([
      { type: 'Application', timeStamp: '2025-01-01T00:00:00Z' },
    ]);
  });

  it('surfaces RateUnavailability when Sabre refuses to return a rate', () => {
    const out = fromCheckResponse(
      okResponse({
        HotelPriceCheckRS: {
          PriceCheckInfo: {
            BookingKey: 'BK-UNAV',
            HotelInfo: { HotelCode: 'X', CodeContext: 'GLOBAL' },
            HotelRateInfo: {
              RateUnavailability: {
                RateSource: [
                  {
                    Source: '110',
                    Reason: 'Results filtered due to rate range search criteria.',
                    DisplayMessage: 'Rate range filtered all the rate',
                  },
                ],
              },
            },
          },
        },
      }),
    );
    expect(out.rateInfo?.unavailability?.sources).toEqual([
      {
        source: '110',
        reason: 'Results filtered due to rate range search criteria.',
        displayMessage: 'Rate range filtered all the rate',
      },
    ]);
    expect(out.rateInfo?.rooms).toBeUndefined();
  });

  it('preserves rooms / rate plans with only required fields', () => {
    const out = fromCheckResponse(
      okResponse({
        HotelPriceCheckRS: {
          PriceCheckInfo: {
            HotelInfo: { HotelCode: 'A', CodeContext: 'GLOBAL' },
            HotelRateInfo: {
              Rooms: {
                Room: [
                  {
                    RoomIndex: 7,
                    RatePlans: {
                      RatePlan: [
                        {
                          PrepaidIndicator: false,
                          RateSource: '112',
                          RateKey: 'K==',
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      }),
    );
    expect(out.rateInfo?.rooms).toEqual([
      {
        roomIndex: 7,
        ratePlans: [{ prepaidIndicator: false, rateSource: '112', rateKey: 'K==' }],
      },
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
      fromCheckResponse(res);
      expect.fail('expected SabreParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(SabreParseError);
      expect((err as SabreParseError).responseBody).toBe('<html>not json</html>');
    }
  });

  it('throws SabreParseError when the body is JSON but not an object', () => {
    expect(() => fromCheckResponse(okResponse(null))).toThrow(SabreParseError);
  });

  it('throws SabreParseError when HotelPriceCheckRS is missing', () => {
    expect(() => fromCheckResponse(okResponse({}))).toThrow(SabreParseError);
  });
});
