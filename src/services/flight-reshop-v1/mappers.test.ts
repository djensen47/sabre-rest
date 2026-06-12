import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { SabreResponse } from '../../http/types.js';
import { fromReshopResponse, toReshopRequest } from './mappers.js';
import type { FlightReshopInput } from './types.js';

const BASE = 'https://api.cert.platform.sabre.com';

const baseJourney = {
  departureLocation: { cityCode: 'DFW' },
  arrivalLocation: { cityCode: 'LAX' },
  departureDate: '2026-09-26',
} as const;

const minimalInput: FlightReshopInput = {
  journeys: [baseJourney],
  tickets: [{ number: '0012972101507' }],
};

const makeResponse = (body: string): SabreResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  body,
});

// ---------------------------------------------------------------------------
// toReshopRequest
// ---------------------------------------------------------------------------

describe('toReshopRequest', () => {
  it('builds a POST to /v1/offers/flightReshop with JSON headers', () => {
    const req = toReshopRequest(BASE, minimalInput);
    expect(req.method).toBe('POST');
    expect(req.url).toBe(`${BASE}/v1/offers/flightReshop`);
    expect(req.headers.Accept).toBe('application/json');
    expect(req.headers['Content-Type']).toBe('application/json');
  });

  it('resolves the path correctly when the base URL has a trailing slash', () => {
    const req = toReshopRequest(`${BASE}/`, minimalInput);
    expect(req.url).toBe(`${BASE}/v1/offers/flightReshop`);
  });

  it('emits the canonical one-way body shape', () => {
    const body = JSON.parse(toReshopRequest(BASE, minimalInput).body ?? '');
    expect(body).toEqual({
      journeys: [
        {
          departureLocation: { cityCode: 'DFW' },
          arrivalLocation: { cityCode: 'LAX' },
          departureDate: '2026-09-26',
        },
      ],
      tickets: [{ number: '0012972101507', overrideCheckedInTicketCoupons: false }],
    });
  });

  it('emits airportCode locations and time windows when supplied', () => {
    const body = JSON.parse(
      toReshopRequest(BASE, {
        journeys: [
          {
            departureLocation: { airportCode: 'JFK' },
            arrivalLocation: { airportCode: 'LAX' },
            departureDate: '2026-04-01',
            departureTimeWindow: { startTime: '09:45', endTime: '13:45' },
          },
        ],
      }).body ?? '',
    );
    expect(body.journeys[0].departureLocation).toEqual({ airportCode: 'JFK' });
    expect(body.journeys[0].departureTimeWindow).toEqual({ startTime: '09:45', endTime: '13:45' });
  });

  it('omits tickets, bookingId, targetPcc, fare, and source when not supplied', () => {
    const body = JSON.parse(
      toReshopRequest(BASE, {
        journeys: minimalInput.journeys,
      }).body ?? '',
    );
    expect(body.tickets).toBeUndefined();
    expect(body.bookingId).toBeUndefined();
    expect(body.targetPcc).toBeUndefined();
    expect(body.fare).toBeUndefined();
    expect(body.source).toBeUndefined();
    expect(body.journeys[0].retainFlights).toBeUndefined();
  });

  it('emits bookingId, targetPcc, cabin (with spec defaults), and distributionModel when supplied', () => {
    const body = JSON.parse(
      toReshopRequest(BASE, {
        journeys: minimalInput.journeys,
        tickets: [{ number: '0012972101507', date: '2026-01-01', travelerIndex: 1 }],
        bookingId: 'GLEBNY',
        targetPcc: 'H50H',
        cabinName: 'Business',
        distributionModel: 'ATPCO',
      }).body ?? '',
    );
    expect(body.bookingId).toBe('GLEBNY');
    expect(body.targetPcc).toBe('H50H');
    expect(body.source).toEqual({ distributionModel: 'ATPCO' });
    expect(body.fare).toEqual({
      cabin: { name: 'Business' },
      forceRetailerRule: false,
      useOriginalPricing: false,
    });
    expect(body.tickets[0]).toEqual({
      number: '0012972101507',
      date: '2026-01-01',
      travelerIndex: 1,
      overrideCheckedInTicketCoupons: false,
    });
  });

  it('emits retainFlights by flightItemId', () => {
    const body = JSON.parse(
      toReshopRequest(BASE, {
        journeys: [{ ...baseJourney, retainFlights: [{ flightItemId: '12' }] }],
      }).body ?? '',
    );
    expect(body.journeys[0].retainFlights).toEqual([{ flightItemId: '12' }]);
  });

  it('emits retainFlights by full flightDetails (required + optional fields)', () => {
    const body = JSON.parse(
      toReshopRequest(BASE, {
        journeys: [
          {
            ...baseJourney,
            retainFlights: [
              {
                flightDetails: {
                  marketingFlightNumber: 123,
                  marketingAirlineCode: 'AA',
                  departureAirportCode: 'DFW',
                  arrivalAirportCode: 'ORD',
                  departureDate: '2026-09-26',
                  departureTime: '09:15',
                  arrivalDate: '2026-09-26',
                  arrivalTime: '11:40',
                  bookingClassCode: 'Y',
                  keepBookingClass: true,
                },
              },
            ],
          },
        ],
      }).body ?? '',
    );
    expect(body.journeys[0].retainFlights).toEqual([
      {
        flightDetails: {
          marketingFlightNumber: 123,
          marketingAirlineCode: 'AA',
          departureAirportCode: 'DFW',
          arrivalAirportCode: 'ORD',
          departureDate: '2026-09-26',
          departureTime: '09:15',
          arrivalDate: '2026-09-26',
          arrivalTime: '11:40',
          bookingClassCode: 'Y',
          keepBookingClass: true,
        },
      },
    ]);
  });

  it('prefers flightItemId over flightDetails when both are supplied', () => {
    const body = JSON.parse(
      toReshopRequest(BASE, {
        journeys: [
          {
            ...baseJourney,
            retainFlights: [
              {
                flightItemId: '7',
                flightDetails: {
                  marketingFlightNumber: 123,
                  marketingAirlineCode: 'AA',
                  departureAirportCode: 'DFW',
                  arrivalAirportCode: 'ORD',
                  departureDate: '2026-09-26',
                  departureTime: '09:15',
                  arrivalDate: '2026-09-26',
                  arrivalTime: '11:40',
                  bookingClassCode: 'Y',
                },
              },
            ],
          },
        ],
      }).body ?? '',
    );
    expect(body.journeys[0].retainFlights).toEqual([{ flightItemId: '7' }]);
  });

  it('throws when a retainFlights item has neither flightItemId nor flightDetails', () => {
    expect(() =>
      toReshopRequest(BASE, {
        journeys: [{ ...baseJourney, retainFlights: [{}] }],
      }),
    ).toThrow(/flightItemId or flightDetails/);
  });
});

// ---------------------------------------------------------------------------
// fromReshopResponse
// ---------------------------------------------------------------------------

describe('fromReshopResponse', () => {
  it('maps a populated offers response', () => {
    const out = fromReshopResponse(
      makeResponse(
        JSON.stringify({
          timestamp: '2026-12-23T14:32:04.986Z',
          numberOfOffers: 1,
          flights: [
            {
              id: 'f-1',
              marketingFlightNumber: 711,
              marketingAirlineCode: 'AA',
              departureAirportCode: 'DFW',
              arrivalAirportCode: 'ONT',
              departureDate: '2026-09-26',
              departureTime: '23:14',
            },
          ],
          journeys: [
            {
              id: 'j-1',
              flightRefs: ['f-1'],
              departureAirportCode: 'DFW',
              arrivalAirportCode: 'ONT',
            },
          ],
          offers: [
            {
              id: 'offer-1',
              source: { distributionModel: 'ATPCO' },
              journeyRefs: ['j-1'],
              isPriceGuaranteed: true,
              totalPriceDifference: {
                type: 'Refund',
                baseFare: '-1432.00',
                grandTotal: '-1539.40',
                currencyCode: 'PLN',
              },
              items: [
                {
                  id: 'item-1',
                  fares: [
                    {
                      travelers: [{ passengerTypeCode: 'ADT', ticketNumber: '0012972101507' }],
                      priceDifference: {
                        type: 'Refund',
                        grandTotal: '-1539.40',
                        currencyCode: 'PLN',
                      },
                      fareComponents: [
                        {
                          fareBasisCode: 'QVAJZNB3',
                          segmentDetails: [
                            { flightRef: 'f-1', bookingClassCode: 'Q', cabinName: 'Economy' },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      ),
    );

    expect(out.timestamp).toBe('2026-12-23T14:32:04.986Z');
    expect(out.numberOfOffers).toBe(1);
    expect(out.flights?.[0]?.marketingAirlineCode).toBe('AA');
    expect(out.journeys?.[0]?.flightRefs).toEqual(['f-1']);
    const offer = out.offers?.[0];
    expect(offer?.id).toBe('offer-1');
    expect(offer?.source?.distributionModel).toBe('ATPCO');
    expect(offer?.totalPriceDifference?.grandTotal).toBe('-1539.40');
    expect(offer?.items?.[0]?.fares?.[0]?.travelers?.[0]?.ticketNumber).toBe('0012972101507');
    expect(offer?.items?.[0]?.fares?.[0]?.priceDifference?.grandTotal).toBe('-1539.40');
    const component = offer?.items?.[0]?.fares?.[0]?.fareComponents?.[0];
    expect(component?.fareBasisCode).toBe('QVAJZNB3');
    expect(component?.segmentDetails?.[0]).toEqual({
      flightRef: 'f-1',
      bookingClassCode: 'Q',
      cabinName: 'Economy',
    });
  });

  it('maps an empty response (no offers, no flights)', () => {
    const out = fromReshopResponse(
      makeResponse(JSON.stringify({ timestamp: '2026-06-04T00:00:00Z' })),
    );
    expect(out.timestamp).toBe('2026-06-04T00:00:00Z');
    expect(out.offers).toBeUndefined();
    expect(out.flights).toBeUndefined();
    expect(out.errors).toBeUndefined();
  });

  it('maps an HTTP-200 error-only response (downline reissue-not-active)', () => {
    const out = fromReshopResponse(
      makeResponse(
        JSON.stringify({
          timestamp: '2026-06-04T15:18:10.601Z',
          errors: [
            {
              category: 'APPLICATION_ERROR',
              type: 'DOWNLINE_SERVICE_ERROR',
              description: 'Automated reissue not active for this ticket',
            },
          ],
        }),
      ),
    );
    expect(out.offers).toBeUndefined();
    expect(out.errors).toHaveLength(1);
    expect(out.errors?.[0]?.type).toBe('DOWNLINE_SERVICE_ERROR');
    expect(out.errors?.[0]?.description).toContain('Automated reissue not active');
  });

  it('maps a warnings array', () => {
    const out = fromReshopResponse(
      makeResponse(
        JSON.stringify({
          warnings: [{ category: 'IGNORED_DETAILS', type: 'BOOKING_ID_NOT_APPLICABLE' }],
        }),
      ),
    );
    expect(out.warnings?.[0]?.type).toBe('BOOKING_ID_NOT_APPLICABLE');
  });

  it('throws SabreParseError when the body is not valid JSON', () => {
    expect(() => fromReshopResponse(makeResponse('not json'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError when the body is JSON but not an object', () => {
    expect(() => fromReshopResponse(makeResponse('42'))).toThrow(SabreParseError);
  });
});
