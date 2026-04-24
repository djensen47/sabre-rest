import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { okResponse } from '../../http/test-utils.js';
import { fromGetAncillariesResponse, toGetAncillariesRequest } from './mappers.js';
import type { GetAncillariesInput } from './types.js';

const minimalInput: GetAncillariesInput = {
  orderId: 'ORDER-123',
};

// ---------------------------------------------------------------------------
// toGetAncillariesRequest
// ---------------------------------------------------------------------------

describe('toGetAncillariesRequest', () => {
  it('builds a POST to the getAncillaries path with JSON headers', () => {
    const req = toGetAncillariesRequest('https://api.cert.platform.sabre.com', minimalInput);
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v2/offers/getAncillaries');
    expect(req.headers.Accept).toBe('application/json');
    expect(req.headers['Content-Type']).toBe('application/json');
  });

  it('handles a base URL with a trailing slash', () => {
    const req = toGetAncillariesRequest('https://api.cert.platform.sabre.com/', minimalInput);
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v2/offers/getAncillaries');
  });

  it('serializes the request body with requestType and orderId', () => {
    const req = toGetAncillariesRequest('https://api.cert.platform.sabre.com', minimalInput);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body.requestType).toBe('orderId');
    const request = body.request as Record<string, unknown>;
    expect(request.orderId).toBe('ORDER-123');
    expect('requestedSegmentRefs' in request).toBe(false);
    expect('requestedPaxRefs' in request).toBe(false);
    expect('groupCode' in request).toBe(false);
  });

  it('includes optional filters when provided', () => {
    const input: GetAncillariesInput = {
      orderId: 'ORDER-123',
      segmentRefs: ['SEG-1', 'SEG-2'],
      passengerRefs: ['PAX-1'],
      groupCode: 'BG',
    };
    const req = toGetAncillariesRequest('https://api.cert.platform.sabre.com', input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const request = body.request as Record<string, unknown>;
    expect(request.requestedSegmentRefs).toEqual(['SEG-1', 'SEG-2']);
    expect(request.requestedPaxRefs).toEqual(['PAX-1']);
    expect(request.groupCode).toBe('BG');
  });

  it('omits empty segment and passenger ref arrays', () => {
    const input: GetAncillariesInput = {
      orderId: 'ORDER-123',
      segmentRefs: [],
      passengerRefs: [],
    };
    const req = toGetAncillariesRequest('https://api.cert.platform.sabre.com', input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const request = body.request as Record<string, unknown>;
    expect('requestedSegmentRefs' in request).toBe(false);
    expect('requestedPaxRefs' in request).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fromGetAncillariesResponse
// ---------------------------------------------------------------------------

describe('fromGetAncillariesResponse', () => {
  const fullResponse = {
    ancillaries: {
      segments: [
        {
          id: 'SEG-1',
          bookingAirlineCode: 'AA',
          bookingFlightNumber: 100,
          departureAirportCode: 'DFW',
          arrivalAirportCode: 'LAX',
          departureDate: '2026-05-15',
          departureTime: '10:00:00',
          cabinCode: 'Y',
          flightLegs: [
            {
              legId: 'LEG-1',
              departureAirportCode: 'DFW',
              arrivalAirportCode: 'LAX',
              equipmentCode: '738',
            },
          ],
        },
      ],
      passengers: [
        { passengerId: 'PAX-1', passengerTypeCode: 'ADT', givenName: 'JOHN', surname: 'DOE' },
      ],
      offer: {
        offerId: 'OFFER-ABC',
        otherServices: [
          {
            offerItemId: 'ITEM-1',
            serviceDefinitionRef: 'SDEF-1',
            priceDefinitionRef: 'PDEF-1',
            segmentRefs: ['SEG-1'],
            passengerRefs: ['PAX-1'],
          },
        ],
      },
      serviceDefinitions: [
        {
          id: 'SDEF-1',
          serviceCode: 'C',
          airlineCode: 'AA',
          commercialName: 'FIRST CHECKED BAG',
          groupCode: 'BG',
          upToWeightLimitInKilograms: 23,
          upToWeightLimitInPounds: 50,
          maximumQuantity: 3,
          bookingMethod: 'No Booking Required',
          reasonForIssuance: 'Baggage',
          descriptionFreeText: [{ id: '0', text: 'UP TO 50 POUNDS/23 KILOGRAMS' }],
        },
      ],
      priceDefinitions: [
        {
          id: 'PDEF-1',
          serviceFee: {
            totalPrice: {
              saleAmount: { amount: '35.00', currencyCode: 'USD' },
              amount: { amount: '30.00', currencyCode: 'USD' },
              taxSummary: {
                taxesTotal: { amount: '5.00', currencyCode: 'USD' },
                taxes: [{ taxCode: 'US', taxAmount: { amount: '5.00', currencyCode: 'USD' } }],
              },
            },
          },
        },
      ],
    },
    warnings: [{ code: '060544', descriptionText: 'Possible uncommitted PNR data' }],
  };

  it('maps a populated response into the public output shape', () => {
    const result = fromGetAncillariesResponse(okResponse(fullResponse));

    // Segments
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.bookingAirlineCode).toBe('AA');
    expect(result.segments[0]?.departureAirportCode).toBe('DFW');
    expect(result.segments[0]?.flightLegs).toHaveLength(1);
    expect(result.segments[0]?.flightLegs[0]?.equipmentCode).toBe('738');

    // Passengers
    expect(result.passengers).toHaveLength(1);
    expect(result.passengers[0]?.givenName).toBe('JOHN');

    // Offer
    expect(result.offerId).toBe('OFFER-ABC');
    expect(result.offerItems).toHaveLength(1);
    expect(result.offerItems[0]?.serviceDefinitionRef).toBe('SDEF-1');
    expect(result.offerItems[0]?.segmentRefs).toEqual(['SEG-1']);

    // Service definitions
    expect(result.serviceDefinitions).toHaveLength(1);
    const sd = result.serviceDefinitions[0];
    expect(sd?.commercialName).toBe('FIRST CHECKED BAG');
    expect(sd?.groupCode).toBe('BG');
    expect(sd?.upToWeightLimitInKilograms).toBe(23);
    expect(sd?.descriptions).toEqual([{ id: '0', text: 'UP TO 50 POUNDS/23 KILOGRAMS' }]);

    // Price definitions
    expect(result.priceDefinitions).toHaveLength(1);
    const pd = result.priceDefinitions[0];
    expect(pd?.serviceFee?.totalPrice?.saleAmount).toEqual({
      amount: '35.00',
      currencyCode: 'USD',
    });
    expect(pd?.serviceFee?.totalPrice?.taxSummary?.taxes).toHaveLength(1);

    // Warnings
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('060544');

    // No errors
    expect(result.errors).toEqual([]);
  });

  it('returns empty arrays when ancillaries is absent', () => {
    const result = fromGetAncillariesResponse(okResponse({}));
    expect(result.segments).toEqual([]);
    expect(result.passengers).toEqual([]);
    expect(result.offerItems).toEqual([]);
    expect(result.serviceDefinitions).toEqual([]);
    expect(result.priceDefinitions).toEqual([]);
    expect(result.offerId).toBeUndefined();
  });

  it('maps errors from the response', () => {
    const result = fromGetAncillariesResponse(
      okResponse({
        errors: [
          {
            code: 'ERR',
            descriptionText: 'Order not found',
            statusText: 'NotProcessed',
            tagText: ['request.order.orderId'],
          },
        ],
      }),
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.descriptionText).toBe('Order not found');
    expect(result.errors[0]?.tagText).toEqual(['request.order.orderId']);
  });

  it('throws SabreParseError for non-JSON body', () => {
    expect(() => fromGetAncillariesResponse(okResponse('not json'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for non-object JSON body', () => {
    expect(() => fromGetAncillariesResponse(okResponse('"string"'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for null body', () => {
    expect(() => fromGetAncillariesResponse(okResponse('null'))).toThrow(SabreParseError);
  });
});
