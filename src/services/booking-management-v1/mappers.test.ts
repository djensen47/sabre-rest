import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { SabreResponse } from '../../http/types.js';
import {
  fromCreateBookingResponse,
  fromGetBookingResponse,
  toCreateBookingRequest,
  toGetBookingRequest,
} from './mappers.js';
import type { CreateBookingInput, GetBookingInput } from './types.js';

const okResponse = (body: unknown): SabreResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const minimalInput: CreateBookingInput = {
  flightDetails: {
    flights: [
      {
        flightNumber: 100,
        airlineCode: 'AA',
        fromAirportCode: 'DFW',
        toAirportCode: 'LAX',
        departureDate: '2026-05-15',
        departureTime: '10:00',
        bookingClass: 'Y',
      },
    ],
  },
  travelers: [{ givenName: 'JOHN', surname: 'DOE', passengerCode: 'ADT' }],
};

// ---------------------------------------------------------------------------
// toCreateBookingRequest
// ---------------------------------------------------------------------------

describe('toCreateBookingRequest', () => {
  it('builds a POST to the createBooking path with JSON headers', () => {
    const req = toCreateBookingRequest('https://api.cert.platform.sabre.com', minimalInput);
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/trip/orders/createBooking');
    expect(req.headers.Accept).toBe('application/json');
    expect(req.headers['Content-Type']).toBe('application/json');
  });

  it('handles a base URL with a trailing slash', () => {
    const req = toCreateBookingRequest('https://api.cert.platform.sabre.com/', minimalInput);
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/trip/orders/createBooking');
  });

  it('sends spec defaults for receivedFrom and asynchronousUpdateWaitTime', () => {
    const req = toCreateBookingRequest('https://api.cert.platform.sabre.com', minimalInput);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body.receivedFrom).toBe('Create Booking');
    expect(body.asynchronousUpdateWaitTime).toBe(0);
  });

  it('allows overriding receivedFrom', () => {
    const input: CreateBookingInput = {
      ...minimalInput,
      receivedFrom: 'My App',
    };
    const req = toCreateBookingRequest('https://api.cert.platform.sabre.com', input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body.receivedFrom).toBe('My App');
  });

  it('sends the default flightStatusCode of NN for flights', () => {
    const req = toCreateBookingRequest('https://api.cert.platform.sabre.com', minimalInput);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const details = body.flightDetails as Record<string, unknown>;
    const flights = details.flights as Record<string, unknown>[];
    expect(flights?.[0]?.flightStatusCode).toBe('NN');
  });

  it('omits optional fields when not provided', () => {
    const req = toCreateBookingRequest('https://api.cert.platform.sabre.com', minimalInput);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect('targetPcc' in body).toBe(false);
    expect('hotel' in body).toBe(false);
    expect('car' in body).toBe(false);
    expect('payment' in body).toBe(false);
    expect('notification' in body).toBe(false);
    expect('otherServices' in body).toBe(false);
    expect('retentionEndDate' in body).toBe(false);
    expect('sendLoyaltiesToAllAirlines' in body).toBe(false);
  });

  it('includes optional fields when provided', () => {
    const input: CreateBookingInput = {
      ...minimalInput,
      targetPcc: 'G7HE',
      errorHandlingPolicy: ['HALT_ON_ERROR', 'DO_NOT_HALT_ON_HOTEL_BOOKING_ERROR'],
      retentionEndDate: '2026-12-31',
      sendLoyaltiesToAllAirlines: true,
    };
    const req = toCreateBookingRequest('https://api.cert.platform.sabre.com', input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body.targetPcc).toBe('G7HE');
    expect(body.errorHandlingPolicy).toEqual([
      'HALT_ON_ERROR',
      'DO_NOT_HALT_ON_HOTEL_BOOKING_ERROR',
    ]);
    expect(body.retentionEndDate).toBe('2026-12-31');
    expect(body.sendLoyaltiesToAllAirlines).toBe(true);
  });

  it('builds NDC flight offer body', () => {
    const input: CreateBookingInput = {
      flightOffer: {
        offerId: 'OFFER-123',
        selectedOfferItems: ['ITEM-1', 'ITEM-2'],
      },
      travelers: [{ givenName: 'JANE', surname: 'DOE' }],
    };
    const req = toCreateBookingRequest('https://api.cert.platform.sabre.com', input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const offer = body.flightOffer as Record<string, unknown>;
    expect(offer.offerId).toBe('OFFER-123');
    expect(offer.selectedOfferItems).toEqual(['ITEM-1', 'ITEM-2']);
  });

  it('builds payment with form of payment', () => {
    const input: CreateBookingInput = {
      ...minimalInput,
      payment: {
        formsOfPayment: [
          {
            type: 'PAYMENTCARD',
            cardTypeCode: 'VI',
            cardNumber: '4111111111111111',
            expiryDate: '2027-12',
            cardHolder: { givenName: 'JOHN', surname: 'DOE' },
          },
        ],
      },
    };
    const req = toCreateBookingRequest('https://api.cert.platform.sabre.com', input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const payment = body.payment as Record<string, unknown>;
    const fops = payment.formsOfPayment as Record<string, unknown>[];
    expect(fops?.[0]?.type).toBe('PAYMENTCARD');
    expect(fops?.[0]?.cardTypeCode).toBe('VI');
    expect(fops?.[0]?.cardNumber).toBe('4111111111111111');
  });

  it('sends hotel defaults (useCsl: true)', () => {
    const input: CreateBookingInput = {
      ...minimalInput,
      hotel: { bookingKey: 'HOTEL-KEY-123' },
    };
    const req = toCreateBookingRequest('https://api.cert.platform.sabre.com', input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const hotel = body.hotel as Record<string, unknown>;
    expect(hotel.useCsl).toBe(true);
    expect(hotel.bookingKey).toBe('HOTEL-KEY-123');
  });

  it('sends car defaults (quantity: 1)', () => {
    const input: CreateBookingInput = {
      ...minimalInput,
      car: { bookingKey: 'CAR-KEY-456' },
    };
    const req = toCreateBookingRequest('https://api.cert.platform.sabre.com', input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const car = body.car as Record<string, unknown>;
    expect(car.quantity).toBe(1);
    expect(car.bookingKey).toBe('CAR-KEY-456');
  });

  it('sends ancillary defaults (numberOfItems: 1)', () => {
    const input: CreateBookingInput = {
      travelers: [
        {
          givenName: 'JOHN',
          surname: 'DOE',
          ancillaries: [
            {
              subcode: '05Z',
              airlineCode: 'AA',
              electronicMiscellaneousDocumentType: 'STANDALONE',
              basePrice: '50.00',
              currencyCode: 'USD',
              groupCode: 'BG',
              flightIndices: [1],
            },
          ],
        },
      ],
    };
    const req = toCreateBookingRequest('https://api.cert.platform.sabre.com', input);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const travelers = body.travelers as Record<string, unknown>[];
    const ancillaries = travelers?.[0]?.ancillaries as Record<string, unknown>[];
    expect(ancillaries?.[0]?.numberOfItems).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// fromCreateBookingResponse
// ---------------------------------------------------------------------------

describe('fromCreateBookingResponse', () => {
  it('maps a full response with booking, flights, and travelers', () => {
    const result = fromCreateBookingResponse(
      okResponse({
        timestamp: '2026-05-01T12:00:00Z',
        confirmationId: 'ABCDEF',
        booking: {
          bookingId: 'ABCDEF',
          startDate: '2026-05-15',
          endDate: '2026-05-15',
          isTicketed: false,
          isCancelable: true,
          flights: [
            {
              itemId: '1',
              flightNumber: 100,
              airlineCode: 'AA',
              fromAirportCode: 'DFW',
              toAirportCode: 'LAX',
              departureDate: '2026-05-15',
              departureTime: '10:00',
              arrivalDate: '2026-05-15',
              arrivalTime: '12:00',
              flightStatusCode: 'HK',
              flightStatusName: 'Confirmed',
            },
          ],
          travelers: [
            {
              givenName: 'JOHN',
              surname: 'DOE',
              passengerCode: 'ADT',
              type: 'ADULT',
            },
          ],
          creationDetails: {
            creationDate: '2026-05-01',
            creationTime: '12:00',
          },
        },
      }),
    );

    expect(result.confirmationId).toBe('ABCDEF');
    expect(result.timestamp).toBe('2026-05-01T12:00:00Z');
    expect(result.booking).toBeDefined();
    expect(result.booking?.bookingId).toBe('ABCDEF');
    expect(result.booking?.flights).toHaveLength(1);
    expect(result.booking?.flights?.[0]?.airlineCode).toBe('AA');
    expect(result.booking?.flights?.[0]?.flightStatusName).toBe('Confirmed');
    expect(result.booking?.travelers).toHaveLength(1);
    expect(result.booking?.travelers?.[0]?.givenName).toBe('JOHN');
    expect(result.booking?.creationDetails?.creationDate).toBe('2026-05-01');
  });

  it('maps a response with errors', () => {
    const result = fromCreateBookingResponse(
      okResponse({
        errors: [
          {
            category: 'BAD_REQUEST',
            type: 'REQUIRED_FIELD_MISSING',
            description: 'givenName is required',
            fieldName: 'givenName',
          },
        ],
      }),
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]?.category).toBe('BAD_REQUEST');
    expect(result.errors?.[0]?.type).toBe('REQUIRED_FIELD_MISSING');
    expect(result.errors?.[0]?.description).toBe('givenName is required');
    expect(result.booking).toBeUndefined();
  });

  it('maps an empty booking response', () => {
    const result = fromCreateBookingResponse(
      okResponse({
        confirmationId: 'XYZABC',
        booking: {},
      }),
    );

    expect(result.confirmationId).toBe('XYZABC');
    expect(result.booking).toBeDefined();
    expect(result.booking?.flights).toBeUndefined();
    expect(result.booking?.travelers).toBeUndefined();
  });

  it('maps fare rules with penalties', () => {
    const result = fromCreateBookingResponse(
      okResponse({
        booking: {
          fareRules: [
            {
              owningAirlineCode: 'AA',
              isRefundable: true,
              refundPenalties: [
                {
                  applicability: 'BEFORE_DEPARTURE',
                  conditionsApply: false,
                  penalty: { amount: '200.00', currencyCode: 'USD' },
                },
              ],
            },
          ],
        },
      }),
    );

    expect(result.booking?.fareRules).toHaveLength(1);
    expect(result.booking?.fareRules?.[0]?.owningAirlineCode).toBe('AA');
    expect(result.booking?.fareRules?.[0]?.refundPenalties?.[0]?.penalty.amount).toBe('200.00');
  });

  it('maps journey information', () => {
    const result = fromCreateBookingResponse(
      okResponse({
        booking: {
          journeys: [
            {
              firstAirportCode: 'DFW',
              departureDate: '2026-05-15',
              departureTime: '10:00',
              lastAirportCode: 'LAX',
              numberOfFlights: 1,
            },
          ],
        },
      }),
    );

    expect(result.booking?.journeys).toHaveLength(1);
    expect(result.booking?.journeys?.[0]?.firstAirportCode).toBe('DFW');
    expect(result.booking?.journeys?.[0]?.numberOfFlights).toBe(1);
  });

  it('throws SabreParseError for non-JSON body', () => {
    expect(() => fromCreateBookingResponse(okResponse('not json'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for null body', () => {
    expect(() => fromCreateBookingResponse(okResponse('null'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for array body', () => {
    expect(() => fromCreateBookingResponse(okResponse('[]'))).toThrow(SabreParseError);
  });
});

// ---------------------------------------------------------------------------
// toGetBookingRequest
// ---------------------------------------------------------------------------

describe('toGetBookingRequest', () => {
  const minimalGetInput: GetBookingInput = { confirmationId: 'GLEBNY' };

  it('builds a POST to the getBooking path with JSON headers', () => {
    const req = toGetBookingRequest('https://api.cert.platform.sabre.com', minimalGetInput);
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/trip/orders/getBooking');
    expect(req.headers.Accept).toBe('application/json');
    expect(req.headers['Content-Type']).toBe('application/json');
  });

  it('handles a base URL with a trailing slash', () => {
    const req = toGetBookingRequest('https://api.cert.platform.sabre.com/', minimalGetInput);
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/trip/orders/getBooking');
  });

  it('sends only confirmationId when no other fields are supplied', () => {
    const req = toGetBookingRequest('https://api.cert.platform.sabre.com', minimalGetInput);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body).toEqual({ confirmationId: 'GLEBNY' });
  });

  it('omits an empty returnOnly list', () => {
    const req = toGetBookingRequest('https://api.cert.platform.sabre.com', {
      confirmationId: 'GLEBNY',
      returnOnly: [],
    });
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect('returnOnly' in body).toBe(false);
  });

  it('forwards returnOnly as an array', () => {
    const req = toGetBookingRequest('https://api.cert.platform.sabre.com', {
      confirmationId: 'GLEBNY',
      returnOnly: ['FLIGHTS', 'TRAVELERS'],
    });
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body.returnOnly).toEqual(['FLIGHTS', 'TRAVELERS']);
  });

  it('forwards optional identity and PCC fields when supplied', () => {
    const req = toGetBookingRequest('https://api.cert.platform.sabre.com', {
      confirmationId: 'GLEBNY',
      bookingSource: 'SABRE_ORDER',
      targetPcc: 'G7HE',
      givenName: 'John',
      middleName: 'W',
      surname: 'Smith',
      unmaskPaymentCardNumbers: true,
    });
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body.bookingSource).toBe('SABRE_ORDER');
    expect(body.targetPcc).toBe('G7HE');
    expect(body.givenName).toBe('John');
    expect(body.middleName).toBe('W');
    expect(body.surname).toBe('Smith');
    expect(body.unmaskPaymentCardNumbers).toBe(true);
  });

  it('only forwards the extraFeatures flags the caller supplied', () => {
    const req = toGetBookingRequest('https://api.cert.platform.sabre.com', {
      confirmationId: 'GLEBNY',
      extraFeatures: {
        returnFrequentRenter: true,
        returnEmptySeatObjects: false,
      },
    });
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const ef = body.extraFeatures as Record<string, unknown>;
    expect(ef).toEqual({
      returnFrequentRenter: true,
      returnEmptySeatObjects: false,
    });
  });
});

// ---------------------------------------------------------------------------
// fromGetBookingResponse
// ---------------------------------------------------------------------------

describe('fromGetBookingResponse', () => {
  it('maps a booking response with top-level metadata', () => {
    const result = fromGetBookingResponse(
      okResponse({
        timestamp: '2026-05-01T12:00:00Z',
        bookingSignature: 'sig-123',
        bookingId: 'GLEBNY',
        isTicketed: true,
        isCancelable: false,
        flights: [
          {
            itemId: '1',
            flightNumber: 100,
            airlineCode: 'AA',
            fromAirportCode: 'DFW',
            toAirportCode: 'LAX',
            departureDate: '2026-05-15',
            departureTime: '10:00',
            arrivalDate: '2026-05-15',
            arrivalTime: '12:00',
          },
        ],
        travelers: [{ givenName: 'JOHN', surname: 'DOE' }],
      }),
    );

    expect(result.timestamp).toBe('2026-05-01T12:00:00Z');
    expect(result.bookingSignature).toBe('sig-123');
    expect(result.bookingId).toBe('GLEBNY');
    expect(result.isTicketed).toBe(true);
    expect(result.isCancelable).toBe(false);
    expect(result.flights).toHaveLength(1);
    expect(result.flights?.[0]?.airlineCode).toBe('AA');
    expect(result.travelers).toHaveLength(1);
    expect(result.travelers?.[0]?.givenName).toBe('JOHN');
  });

  it('maps the echoed request', () => {
    const result = fromGetBookingResponse(
      okResponse({
        bookingId: 'GLEBNY',
        request: {
          confirmationId: 'GLEBNY',
          bookingSource: 'SABRE',
          returnOnly: ['FLIGHTS', 'TRAVELERS'],
          extraFeatures: { returnFrequentRenter: true },
        },
      }),
    );

    expect(result.request?.confirmationId).toBe('GLEBNY');
    expect(result.request?.bookingSource).toBe('SABRE');
    expect(result.request?.returnOnly).toEqual(['FLIGHTS', 'TRAVELERS']);
    expect(result.request?.extraFeatures?.returnFrequentRenter).toBe(true);
  });

  it('maps errors when present', () => {
    const result = fromGetBookingResponse(
      okResponse({
        errors: [
          {
            category: 'NOT_FOUND',
            type: 'BOOKING_NOT_FOUND',
            description: 'No booking with that confirmationId',
          },
        ],
      }),
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]?.category).toBe('NOT_FOUND');
    expect(result.errors?.[0]?.type).toBe('BOOKING_NOT_FOUND');
  });

  it('maps an empty booking payload', () => {
    const result = fromGetBookingResponse(okResponse({}));
    expect(result.bookingId).toBeUndefined();
    expect(result.flights).toBeUndefined();
    expect(result.errors).toBeUndefined();
  });

  it('throws SabreParseError for non-JSON body', () => {
    expect(() => fromGetBookingResponse(okResponse('not json'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for null body', () => {
    expect(() => fromGetBookingResponse(okResponse('null'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for array body', () => {
    expect(() => fromGetBookingResponse(okResponse('[]'))).toThrow(SabreParseError);
  });
});
