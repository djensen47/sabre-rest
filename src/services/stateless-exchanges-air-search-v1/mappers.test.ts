import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { okResponse } from '../../http/test-utils.js';
import type { SabreResponse } from '../../http/types.js';
import { fromSearchResponse, toSearchRequest } from './mappers.js';
import type { SearchExchangeFlightsInput } from './types.js';

const baseInput: SearchExchangeFlightsInput = {
  pnrLocator: 'LVKWZG',
  shoppingSource: 'ExchangeShop',
  itineraryParts: [
    {
      referenceNumber: 1,
      departureDate: '2026-09-01',
      departureAirportCode: 'DFW',
      arrivalAirportCode: 'LHR',
      shopForExchange: true,
    },
  ],
  clientContext: { pseudoCityCode: 'XYZ' },
};

describe('toSearchRequest', () => {
  it('builds a POST to /v1/dc/exchanges/getFlights with JSON content', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', baseInput);
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/dc/exchanges/getFlights');
    expect(req.headers.Accept).toBe('application/json');
    expect(req.headers['Content-Type']).toBe('application/json');
  });

  it('handles a base URL with a trailing slash', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com/', baseInput);
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/dc/exchanges/getFlights');
  });

  it('sends overrideCkinStatus: false when consumer omits it', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', baseInput);
    const body = JSON.parse(req.body as string);
    expect(body.overrideCkinStatus).toBe(false);
  });

  it('preserves overrideCkinStatus: true when consumer supplies it', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', {
      ...baseInput,
      overrideCkinStatus: true,
    });
    const body = JSON.parse(req.body as string);
    expect(body.overrideCkinStatus).toBe(true);
  });

  it('omits travelPreferences when not supplied', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', baseInput);
    const body = JSON.parse(req.body as string);
    expect(body.travelPreferences).toBeUndefined();
  });

  it('omits exchangeDocuments when not supplied', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', baseInput);
    const body = JSON.parse(req.body as string);
    expect(body.exchangeDocuments).toBeUndefined();
  });

  it('omits calculateReaccommodationRules when not supplied', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', baseInput);
    const body = JSON.parse(req.body as string);
    expect(body.calculateReaccommodationRules).toBeUndefined();
  });

  it('serializes exchangeDocuments and travelPreferences when provided', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', {
      ...baseInput,
      exchangeDocuments: [
        { number: '7952164246136', passengerNameNumber: '01.01', passengerTypeCode: 'ADT' },
      ],
      travelPreferences: { returnNoPenaltyFares: true, preferredCabinCode: 'Y' },
      calculateReaccommodationRules: true,
    });
    const body = JSON.parse(req.body as string);
    expect(body.exchangeDocuments).toEqual([
      { number: '7952164246136', passengerNameNumber: '01.01', passengerTypeCode: 'ADT' },
    ]);
    expect(body.travelPreferences).toEqual({ returnNoPenaltyFares: true, preferredCabinCode: 'Y' });
    expect(body.calculateReaccommodationRules).toBe(true);
  });

  it('serializes itineraryParts and clientContext at the top level', () => {
    const req = toSearchRequest('https://api.cert.platform.sabre.com', baseInput);
    const body = JSON.parse(req.body as string);
    expect(body.pnrLocator).toBe('LVKWZG');
    expect(body.shoppingSource).toBe('ExchangeShop');
    expect(body.itineraryParts).toEqual([
      {
        referenceNumber: 1,
        departureDate: '2026-09-01',
        departureAirportCode: 'DFW',
        arrivalAirportCode: 'LHR',
        shopForExchange: true,
      },
    ]);
    expect(body.clientContext).toEqual({ pseudoCityCode: 'XYZ' });
  });
});

describe('fromSearchResponse', () => {
  it('returns empty arrays for an empty envelope', () => {
    const out = fromSearchResponse(okResponse({}));
    expect(out.pricedItineraries).toEqual([]);
    expect(out.warnings).toEqual([]);
    expect(out.errors).toEqual([]);
  });

  it('flows ChangeFees through totalPriceDifference.totalBreakdown.totalFees', () => {
    const out = fromSearchResponse(
      okResponse({
        pricedItineraries: [
          {
            airItineraryPricing: {
              fares: [
                {
                  totalPriceDifference: {
                    differenceType: 'AddCollect',
                    total: { amount: '230.00', currencyCode: 'USD' },
                    totalBreakdown: {
                      fare: { amount: '180.00', currencyCode: 'USD' },
                      tax: { amount: '50.00', currencyCode: 'USD' },
                      totalFees: [{ amount: '50.00', currencyCode: 'USD', feeType: 'ChangeFees' }],
                      nonRefundableAmount: { amount: '0.00', currencyCode: 'USD' },
                    },
                  },
                },
              ],
            },
          },
        ],
      }),
    );

    expect(out.pricedItineraries).toHaveLength(1);
    const fare = out.pricedItineraries[0]?.airItineraryPricing?.fares[0];
    expect(fare?.totalPriceDifference?.differenceType).toBe('AddCollect');
    expect(fare?.totalPriceDifference?.totalBreakdown?.totalFees).toEqual([
      { amount: '50.00', currencyCode: 'USD', feeType: 'ChangeFees' },
    ]);
  });

  it('flows the refund disposition (no fees, Refund type)', () => {
    const out = fromSearchResponse(
      okResponse({
        pricedItineraries: [
          {
            airItineraryPricing: {
              fares: [
                {
                  totalPriceDifference: {
                    differenceType: 'Refund',
                    total: { amount: '120.00', currencyCode: 'USD' },
                    totalBreakdown: {
                      fare: { amount: '-120.00', currencyCode: 'USD' },
                      tax: { amount: '0.00', currencyCode: 'USD' },
                      totalFees: [],
                      nonRefundableAmount: { amount: '0.00', currencyCode: 'USD' },
                    },
                  },
                },
              ],
            },
          },
        ],
      }),
    );

    const tpd = out.pricedItineraries[0]?.airItineraryPricing?.fares[0]?.totalPriceDifference;
    expect(tpd?.differenceType).toBe('Refund');
    expect(tpd?.totalBreakdown?.totalFees).toEqual([]);
  });

  it('flows the even / no-fee disposition (Even type, empty totalFees)', () => {
    const out = fromSearchResponse(
      okResponse({
        pricedItineraries: [
          {
            airItineraryPricing: {
              fares: [
                {
                  totalPriceDifference: {
                    differenceType: 'Even',
                    total: { amount: '0.00', currencyCode: 'USD' },
                    totalBreakdown: {
                      fare: { amount: '0.00', currencyCode: 'USD' },
                      tax: { amount: '0.00', currencyCode: 'USD' },
                      totalFees: [],
                      nonRefundableAmount: { amount: '0.00', currencyCode: 'USD' },
                    },
                  },
                },
              ],
            },
          },
        ],
      }),
    );

    const tpd = out.pricedItineraries[0]?.airItineraryPricing?.fares[0]?.totalPriceDifference;
    expect(tpd?.differenceType).toBe('Even');
    expect(tpd?.totalBreakdown?.totalFees).toEqual([]);
  });

  it('preserves warnings and errors from the 200 envelope', () => {
    const out = fromSearchResponse(
      okResponse({
        pricedItineraries: [],
        warnings: [{ category: 'INFO', type: 'NO_PENALTY_FARES_FOUND' }],
        errors: [
          {
            category: 'BAD_REQUEST',
            type: 'INVALID_PNR',
            description: 'PNR is not exchangeable',
          },
        ],
      }),
    );

    expect(out.warnings).toEqual([{ category: 'INFO', type: 'NO_PENALTY_FARES_FOUND' }]);
    expect(out.errors).toEqual([
      {
        category: 'BAD_REQUEST',
        type: 'INVALID_PNR',
        description: 'PNR is not exchangeable',
      },
    ]);
  });

  it('preserves reaccommodationRule on per-passenger price details', () => {
    const out = fromSearchResponse(
      okResponse({
        pricedItineraries: [
          {
            airItineraryPricing: {
              fares: [
                {
                  passengersPriceDetails: [
                    {
                      documentNumber: '7952149868597',
                      typeCode: 'ADT',
                      reaccommodationRule: {
                        isChangeFeeWaived: true,
                        changeFeeRuleId: '58071',
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
    );

    const passenger =
      out.pricedItineraries[0]?.airItineraryPricing?.fares[0]?.passengersPriceDetails[0];
    expect(passenger?.reaccommodationRule).toEqual({
      isChangeFeeWaived: true,
      changeFeeRuleId: '58071',
    });
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
});
