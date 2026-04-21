import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { SabreResponse } from '../../http/types.js';
import {
  fromCancelBookingResponse,
  fromCreateBookingResponse,
  fromGetBookingResponse,
  fromModifyBookingResponse,
  toCancelBookingRequest,
  toCreateBookingRequest,
  toGetBookingRequest,
  toModifyBookingRequest,
} from './mappers.js';
import type {
  CancelBookingInput,
  CreateBookingInput,
  GetBookingInput,
  ModifyBookingInput,
} from './types.js';

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

// ---------------------------------------------------------------------------
// toModifyBookingRequest
// ---------------------------------------------------------------------------

describe('toModifyBookingRequest', () => {
  const minimalModifyInput: ModifyBookingInput = {
    confirmationId: 'GLEBNY',
    bookingSignature: 'sig-abc-123',
    before: {},
    after: {},
  };

  it('builds a POST to the modifyBooking path with JSON headers', () => {
    const req = toModifyBookingRequest('https://api.cert.platform.sabre.com', minimalModifyInput);
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/trip/orders/modifyBooking');
    expect(req.headers.Accept).toBe('application/json');
    expect(req.headers['Content-Type']).toBe('application/json');
  });

  it('handles a base URL with a trailing slash', () => {
    const req = toModifyBookingRequest('https://api.cert.platform.sabre.com/', minimalModifyInput);
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/trip/orders/modifyBooking');
  });

  it('sends required fields and spec defaults', () => {
    const req = toModifyBookingRequest('https://api.cert.platform.sabre.com', minimalModifyInput);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body.confirmationId).toBe('GLEBNY');
    expect(body.bookingSignature).toBe('sig-abc-123');
    expect(body.retrieveBooking).toBe(false);
    expect(body.receivedFrom).toBe('Modify Booking');
    expect(body.before).toEqual({});
    expect(body.after).toEqual({});
  });

  it('allows overriding retrieveBooking and receivedFrom', () => {
    const req = toModifyBookingRequest('https://api.cert.platform.sabre.com', {
      ...minimalModifyInput,
      retrieveBooking: true,
      receivedFrom: 'My Application',
    });
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body.retrieveBooking).toBe(true);
    expect(body.receivedFrom).toBe('My Application');
  });

  it('omits optional top-level fields when not provided', () => {
    const req = toModifyBookingRequest('https://api.cert.platform.sabre.com', minimalModifyInput);
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect('bookingSource' in body).toBe(false);
    expect('targetPcc' in body).toBe(false);
    expect('unmaskPaymentCardNumbers' in body).toBe(false);
    expect('extraFeatures' in body).toBe(false);
  });

  it('forwards optional top-level fields when provided', () => {
    const req = toModifyBookingRequest('https://api.cert.platform.sabre.com', {
      ...minimalModifyInput,
      bookingSource: 'SABRE_ORDER',
      targetPcc: 'G7HE',
      unmaskPaymentCardNumbers: true,
      extraFeatures: { returnFrequentRenter: true },
    });
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    expect(body.bookingSource).toBe('SABRE_ORDER');
    expect(body.targetPcc).toBe('G7HE');
    expect(body.unmaskPaymentCardNumbers).toBe(true);
    expect(body.extraFeatures).toEqual({ returnFrequentRenter: true });
  });

  it('builds a flight seat assignment in the after snapshot', () => {
    const req = toModifyBookingRequest('https://api.cert.platform.sabre.com', {
      ...minimalModifyInput,
      before: { flights: [{ seats: [null, { number: '14B' }] }] },
      after: { flights: [{ seats: [{ number: '13A' }, { number: '14B' }] }] },
    });
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const before = body.before as Record<string, unknown>;
    const beforeFlights = before.flights as Record<string, unknown>[];
    expect((beforeFlights?.[0]?.seats as unknown[])?.[0]).toBeNull();
    expect((beforeFlights?.[0]?.seats as Record<string, unknown>[])?.[1]?.number).toBe('14B');
    const after = body.after as Record<string, unknown>;
    const afterFlights = after.flights as Record<string, unknown>[];
    expect((afterFlights?.[0]?.seats as Record<string, unknown>[])?.[0]?.number).toBe('13A');
  });

  it('builds a remark change in the after snapshot', () => {
    const req = toModifyBookingRequest('https://api.cert.platform.sabre.com', {
      ...minimalModifyInput,
      before: { remarks: [{ type: 'GENERAL', text: 'Original remark' }] },
      after: { remarks: [{ type: 'GENERAL', text: 'Updated remark' }] },
    });
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const after = body.after as Record<string, unknown>;
    const remarks = after.remarks as Record<string, unknown>[];
    expect(remarks?.[0]?.text).toBe('Updated remark');
    expect(remarks?.[0]?.type).toBe('GENERAL');
  });

  it('builds hotel modification with required fields', () => {
    const req = toModifyBookingRequest('https://api.cert.platform.sabre.com', {
      ...minimalModifyInput,
      after: {
        hotels: [
          {
            itemId: '12',
            leadTravelerIndex: 1,
            numberOfGuests: 2,
            paymentPolicy: 'GUARANTEE',
            room: { travelerIndices: [1, 2] },
            checkInDate: '2026-07-09',
            checkOutDate: '2026-07-12',
          },
        ],
      },
    });
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const after = body.after as Record<string, unknown>;
    const hotel = (after.hotels as Record<string, unknown>[])?.[0];
    expect(hotel?.itemId).toBe('12');
    expect(hotel?.leadTravelerIndex).toBe(1);
    expect(hotel?.numberOfGuests).toBe(2);
    expect(hotel?.paymentPolicy).toBe('GUARANTEE');
    expect((hotel?.room as Record<string, unknown>)?.travelerIndices).toEqual([1, 2]);
    expect(hotel?.checkInDate).toBe('2026-07-09');
  });

  it('builds traveler changes with identity documents and loyalty programs', () => {
    const req = toModifyBookingRequest('https://api.cert.platform.sabre.com', {
      ...minimalModifyInput,
      after: {
        travelers: [
          {
            givenName: 'JANE',
            surname: 'DOE',
            identityDocuments: [
              {
                documentType: 'PASSPORT',
                documentNumber: 'A1234567',
                flights: [{ itemId: '1' }],
              },
            ],
            loyaltyPrograms: [{ supplierCode: 'AA', programNumber: '111222333' }],
          },
        ],
      },
    });
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const after = body.after as Record<string, unknown>;
    const traveler = (after.travelers as Record<string, unknown>[])?.[0];
    expect(traveler?.givenName).toBe('JANE');
    const docs = traveler?.identityDocuments as Record<string, unknown>[];
    expect(docs?.[0]?.documentType).toBe('PASSPORT');
    expect(docs?.[0]?.documentNumber).toBe('A1234567');
    expect((docs?.[0]?.flights as Record<string, unknown>[])?.[0]?.itemId).toBe('1');
    const programs = traveler?.loyaltyPrograms as Record<string, unknown>[];
    expect(programs?.[0]?.supplierCode).toBe('AA');
    expect(programs?.[0]?.programNumber).toBe('111222333');
  });

  it('builds a special service addition', () => {
    const req = toModifyBookingRequest('https://api.cert.platform.sabre.com', {
      ...minimalModifyInput,
      after: {
        specialServices: [
          {
            code: 'WCHR',
            travelerIndices: [1],
            flights: [{ itemId: '1' }],
            message: '/PREPAID',
          },
        ],
      },
    });
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const after = body.after as Record<string, unknown>;
    const ssr = (after.specialServices as Record<string, unknown>[])?.[0];
    expect(ssr?.code).toBe('WCHR');
    expect(ssr?.travelerIndices).toEqual([1]);
    expect(ssr?.message).toBe('/PREPAID');
    expect((ssr?.flights as Record<string, unknown>[])?.[0]?.itemId).toBe('1');
  });

  it('builds retention date changes', () => {
    const req = toModifyBookingRequest('https://api.cert.platform.sabre.com', {
      ...minimalModifyInput,
      after: { retentionEndDate: '2026-12-31', retentionLabel: 'HOLD FOR APPROVAL' },
    });
    const body = JSON.parse(req.body ?? '{}') as Record<string, unknown>;
    const after = body.after as Record<string, unknown>;
    expect(after.retentionEndDate).toBe('2026-12-31');
    expect(after.retentionLabel).toBe('HOLD FOR APPROVAL');
  });
});

// ---------------------------------------------------------------------------
// fromModifyBookingResponse
// ---------------------------------------------------------------------------

describe('fromModifyBookingResponse', () => {
  it('maps a response with timestamp and booking contents', () => {
    const result = fromModifyBookingResponse(
      okResponse({
        timestamp: '2026-05-01T12:00:00Z',
        booking: {
          bookingId: 'GLEBNY',
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
            },
          ],
        },
      }),
    );

    expect(result.timestamp).toBe('2026-05-01T12:00:00Z');
    expect(result.booking?.bookingId).toBe('GLEBNY');
    expect(result.booking?.flights).toHaveLength(1);
    expect(result.booking?.flights?.[0]?.airlineCode).toBe('AA');
  });

  it('maps errors when present', () => {
    const result = fromModifyBookingResponse(
      okResponse({
        errors: [
          {
            category: 'CONFLICT',
            type: 'SIGNATURE_MISMATCH',
            description: 'Booking has changed since the signature was issued',
          },
        ],
      }),
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]?.category).toBe('CONFLICT');
    expect(result.errors?.[0]?.type).toBe('SIGNATURE_MISMATCH');
    expect(result.booking).toBeUndefined();
  });

  it('maps the echoed request', () => {
    const result = fromModifyBookingResponse(
      okResponse({
        request: {
          confirmationId: 'GLEBNY',
          bookingSignature: 'sig-abc',
          before: {},
          after: { remarks: [{ type: 'GENERAL', text: 'new remark' }] },
          retrieveBooking: true,
          receivedFrom: 'Modify Booking',
        },
      }),
    );

    expect(result.request?.confirmationId).toBe('GLEBNY');
    expect(result.request?.bookingSignature).toBe('sig-abc');
    expect(result.request?.retrieveBooking).toBe(true);
    expect(result.request?.after.remarks?.[0]?.text).toBe('new remark');
  });

  it('maps an empty response body', () => {
    const result = fromModifyBookingResponse(okResponse({}));
    expect(result.timestamp).toBeUndefined();
    expect(result.booking).toBeUndefined();
    expect(result.errors).toBeUndefined();
    expect(result.request).toBeUndefined();
  });

  it('throws SabreParseError for non-JSON body', () => {
    expect(() => fromModifyBookingResponse(okResponse('not json'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for null body', () => {
    expect(() => fromModifyBookingResponse(okResponse('null'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for array body', () => {
    expect(() => fromModifyBookingResponse(okResponse('[]'))).toThrow(SabreParseError);
  });
});

// ---------------------------------------------------------------------------
// toCancelBookingRequest
// ---------------------------------------------------------------------------

const minimalCancelInput: CancelBookingInput = { confirmationId: 'GLEBNY' };

describe('toCancelBookingRequest', () => {
  it('builds a POST to the cancelBooking path with JSON headers', () => {
    const req = toCancelBookingRequest('https://api.cert.platform.sabre.com', minimalCancelInput);
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/trip/orders/cancelBooking');
    expect(req.headers.Accept).toBe('application/json');
    expect(req.headers['Content-Type']).toBe('application/json');
  });

  it('tolerates a base URL with a trailing slash', () => {
    const req = toCancelBookingRequest('https://api.cert.platform.sabre.com/', minimalCancelInput);
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v1/trip/orders/cancelBooking');
  });

  it('sends spec-defined defaults for unspecified defaulted fields', () => {
    const req = toCancelBookingRequest('https://api.cert.platform.sabre.com', minimalCancelInput);
    const body = JSON.parse(req.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      confirmationId: 'GLEBNY',
      retrieveBooking: false,
      cancelAll: false,
      voidNonElectronicTickets: false,
      errorHandlingPolicy: 'HALT_ON_ERROR',
      refundDocumentsType: 'Tickets',
    });
  });

  it('forwards per-type item references and segment references', () => {
    const req = toCancelBookingRequest('https://api.cert.platform.sabre.com', {
      confirmationId: 'GLEBNY',
      cancelAll: false,
      flights: [{ itemId: '1' }],
      hotels: [{ itemId: '2' }],
      cars: [{ itemId: '3' }],
      trains: [{ itemId: '4' }],
      cruises: [{ itemId: '5' }],
      segments: [{ sequence: 1 }, { id: 'A' }],
    });
    const body = JSON.parse(req.body as string) as Record<string, unknown>;
    expect(body.flights).toEqual([{ itemId: '1' }]);
    expect(body.hotels).toEqual([{ itemId: '2' }]);
    expect(body.cars).toEqual([{ itemId: '3' }]);
    expect(body.trains).toEqual([{ itemId: '4' }]);
    expect(body.cruises).toEqual([{ itemId: '5' }]);
    expect(body.segments).toEqual([{ sequence: 1 }, { id: 'A' }]);
  });

  it('omits empty reference arrays', () => {
    const req = toCancelBookingRequest('https://api.cert.platform.sabre.com', {
      confirmationId: 'GLEBNY',
      flights: [],
      hotels: [],
    });
    const body = JSON.parse(req.body as string) as Record<string, unknown>;
    expect(body.flights).toBeUndefined();
    expect(body.hotels).toBeUndefined();
  });

  it('forwards ticket operation, notification, and printer designations', () => {
    const req = toCancelBookingRequest('https://api.cert.platform.sabre.com', {
      confirmationId: 'GLEBNY',
      flightTicketOperation: 'VOID',
      notification: { email: 'INVOICE', queuePlacement: [{ prefatoryInstructionCode: 11 }] },
      designatePrinters: [
        {
          profileNumber: 1,
          hardcopy: { address: 'EF34GH', spacing: '1' },
          invoiceItinerary: 'AB12CD',
          ticket: { address: 'IJ56KL', countryCode: 'US' },
        },
      ],
    });
    const body = JSON.parse(req.body as string) as Record<string, unknown>;
    expect(body.flightTicketOperation).toBe('VOID');
    expect(body.notification).toEqual({
      email: 'INVOICE',
      queuePlacement: [{ prefatoryInstructionCode: 11 }],
    });
    expect(body.designatePrinters).toEqual([
      {
        profileNumber: 1,
        hardcopy: { address: 'EF34GH', spacing: '1' },
        invoiceItinerary: 'AB12CD',
        ticket: { address: 'IJ56KL', countryCode: 'US' },
      },
    ]);
  });

  it('respects consumer overrides of defaulted fields', () => {
    const req = toCancelBookingRequest('https://api.cert.platform.sabre.com', {
      confirmationId: 'GLEBNY',
      retrieveBooking: true,
      cancelAll: true,
      voidNonElectronicTickets: true,
      errorHandlingPolicy: 'ALLOW_PARTIAL_CANCEL',
      refundDocumentsType: 'Tickets and EMDs',
    });
    const body = JSON.parse(req.body as string) as Record<string, unknown>;
    expect(body.retrieveBooking).toBe(true);
    expect(body.cancelAll).toBe(true);
    expect(body.voidNonElectronicTickets).toBe(true);
    expect(body.errorHandlingPolicy).toBe('ALLOW_PARTIAL_CANCEL');
    expect(body.refundDocumentsType).toBe('Tickets and EMDs');
  });
});

// ---------------------------------------------------------------------------
// fromCancelBookingResponse
// ---------------------------------------------------------------------------

describe('fromCancelBookingResponse', () => {
  it('maps response metadata, voided and refunded tickets, and flight refunds', () => {
    const result = fromCancelBookingResponse(
      okResponse({
        timestamp: '2026-05-01T12:00:00Z',
        voidedTickets: ['0017544536141'],
        refundedTickets: ['0017544536142'],
        flightRefunds: [
          {
            airlineCode: 'AA',
            confirmationId: 'GLEBNY',
            refundTotals: { total: '120.00', currencyCode: 'USD' },
          },
        ],
      }),
    );
    expect(result.timestamp).toBe('2026-05-01T12:00:00Z');
    expect(result.voidedTickets).toEqual(['0017544536141']);
    expect(result.refundedTickets).toEqual(['0017544536142']);
    expect(result.flightRefunds?.[0]?.airlineCode).toBe('AA');
    expect(result.flightRefunds?.[0]?.refundTotals.total).toBe('120.00');
  });

  it('maps ticket eligibility with refund penalties and taxes', () => {
    const result = fromCancelBookingResponse(
      okResponse({
        tickets: [
          {
            number: '0017544536141',
            isVoidable: true,
            isRefundable: true,
            isAutomatedRefundsEligible: false,
            refundPenalties: [
              {
                applicability: 'BEFORE_DEPARTURE',
                conditionsApply: false,
                penalty: { amount: '25.00', currencyCode: 'USD' },
                source: 'Category 33',
                noShowPenalty: { penalty: { amount: '50.00', currencyCode: 'USD' } },
              },
            ],
            refundTaxes: [{ taxCode: 'XY', amount: '5.00' }],
            refundTotals: { total: '100.00', currencyCode: 'USD' },
            isChangeable: true,
            exchangePenalties: [
              {
                applicability: 'AFTER_DEPARTURE',
                conditionsApply: true,
                penalty: { amount: '75.00', currencyCode: 'USD' },
              },
            ],
          },
        ],
      }),
    );
    const ticket = result.tickets?.[0];
    expect(ticket?.number).toBe('0017544536141');
    expect(ticket?.isVoidable).toBe(true);
    expect(ticket?.refundPenalties?.[0]?.applicability).toBe('BEFORE_DEPARTURE');
    expect(ticket?.refundPenalties?.[0]?.source).toBe('Category 33');
    expect(ticket?.refundPenalties?.[0]?.noShowPenalty?.amount).toBe('50.00');
    expect(ticket?.refundTaxes).toEqual([{ taxCode: 'XY', amount: '5.00' }]);
    expect(ticket?.refundTotals?.total).toBe('100.00');
    expect(ticket?.exchangePenalties?.[0]?.applicability).toBe('AFTER_DEPARTURE');
  });

  it('maps the request echo back into CancelBookingInput', () => {
    const result = fromCancelBookingResponse(
      okResponse({
        request: {
          confirmationId: 'GLEBNY',
          retrieveBooking: true,
          cancelAll: false,
          voidNonElectronicTickets: false,
          errorHandlingPolicy: 'ALLOW_PARTIAL_CANCEL',
          flightTicketOperation: 'REFUND',
          flights: [{ itemId: '1' }],
          segments: [{ sequence: 1 }, { id: 'A' }],
          targetPcc: 'G7HE',
        },
      }),
    );
    expect(result.request?.confirmationId).toBe('GLEBNY');
    expect(result.request?.retrieveBooking).toBe(true);
    expect(result.request?.errorHandlingPolicy).toBe('ALLOW_PARTIAL_CANCEL');
    expect(result.request?.flightTicketOperation).toBe('REFUND');
    expect(result.request?.flights).toEqual([{ itemId: '1' }]);
    expect(result.request?.segments).toEqual([{ sequence: 1 }, { id: 'A' }]);
    expect(result.request?.targetPcc).toBe('G7HE');
  });

  it('maps errors', () => {
    const result = fromCancelBookingResponse(
      okResponse({
        errors: [{ category: 'BAD_REQUEST', type: 'INVALID_CONFIRMATION_ID' }],
      }),
    );
    expect(result.errors?.[0]?.category).toBe('BAD_REQUEST');
  });

  it('maps an empty response body', () => {
    const result = fromCancelBookingResponse(okResponse({}));
    expect(result.timestamp).toBeUndefined();
    expect(result.booking).toBeUndefined();
    expect(result.tickets).toBeUndefined();
    expect(result.voidedTickets).toBeUndefined();
    expect(result.refundedTickets).toBeUndefined();
    expect(result.flightRefunds).toBeUndefined();
    expect(result.errors).toBeUndefined();
    expect(result.request).toBeUndefined();
  });

  it('throws SabreParseError for non-JSON body', () => {
    expect(() => fromCancelBookingResponse(okResponse('not json'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for null body', () => {
    expect(() => fromCancelBookingResponse(okResponse('null'))).toThrow(SabreParseError);
  });

  it('throws SabreParseError for array body', () => {
    expect(() => fromCancelBookingResponse(okResponse('[]'))).toThrow(SabreParseError);
  });
});
