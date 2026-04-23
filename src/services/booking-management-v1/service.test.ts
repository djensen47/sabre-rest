import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type {
  CancelBookingInput,
  CreateBookingInput,
  FulfillTicketsInput,
  GetBookingInput,
  ModifyBookingInput,
} from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
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

const responseBody = {
  timestamp: '2026-05-01T12:00:00Z',
  confirmationId: 'ABCDEF',
  booking: {
    bookingId: 'ABCDEF',
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
  },
};

describe('BookingManagementV1Service.createBooking', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the createBooking URL with bearer auth and JSON headers', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    const result = await client.bookingManagementV1.createBooking(minimalInput);

    expect(result.confirmationId).toBe('ABCDEF');
    expect(result.booking?.bookingId).toBe('ABCDEF');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v1/trip/orders/createBooking');

    const requestInit = init as RequestInit;
    expect(requestInit.method).toBe('POST');
    const headers = requestInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('surfaces a non-2xx response as SabreApiResponseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(
            JSON.stringify({
              errors: [{ category: 'BAD_REQUEST', type: 'VALIDATION_ERROR' }],
            }),
            { status: 400, statusText: 'Bad Request' },
          ),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.bookingManagementV1.createBooking(minimalInput)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});

describe('BookingManagementV1Service.getBooking', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const minimalGetInput: GetBookingInput = { confirmationId: 'GLEBNY' };

  const getResponseBody = {
    timestamp: '2026-05-01T12:00:00Z',
    bookingSignature: 'sig-abc',
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
  };

  it('POSTs to the getBooking URL with bearer auth and JSON headers', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(JSON.stringify(getResponseBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    const result = await client.bookingManagementV1.getBooking(minimalGetInput);

    expect(result.bookingId).toBe('GLEBNY');
    expect(result.bookingSignature).toBe('sig-abc');
    expect(result.timestamp).toBe('2026-05-01T12:00:00Z');
    expect(result.flights?.[0]?.airlineCode).toBe('AA');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v1/trip/orders/getBooking');

    const requestInit = init as RequestInit;
    expect(requestInit.method).toBe('POST');
    const headers = requestInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse((requestInit.body as string) ?? '{}') as Record<string, unknown>;
    expect(body).toEqual({ confirmationId: 'GLEBNY' });
  });

  it('surfaces a non-2xx response as SabreApiResponseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(
            JSON.stringify({
              errors: [{ category: 'NOT_FOUND', type: 'BOOKING_NOT_FOUND' }],
            }),
            { status: 404, statusText: 'Not Found' },
          ),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.bookingManagementV1.getBooking(minimalGetInput)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 404,
    });
  });
});

describe('BookingManagementV1Service.modifyBooking', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const minimalModifyInput: ModifyBookingInput = {
    confirmationId: 'GLEBNY',
    bookingSignature: 'sig-abc',
    before: {},
    after: { remarks: [{ type: 'GENERAL', text: 'new note' }] },
  };

  const modifyResponseBody = {
    timestamp: '2026-05-01T12:00:00Z',
    booking: {
      bookingId: 'GLEBNY',
      isTicketed: false,
      isCancelable: true,
      remarks: [{ type: 'GENERAL', text: 'new note' }],
    },
  };

  it('POSTs to the modifyBooking URL with bearer auth and JSON headers', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(JSON.stringify(modifyResponseBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    const result = await client.bookingManagementV1.modifyBooking(minimalModifyInput);

    expect(result.timestamp).toBe('2026-05-01T12:00:00Z');
    expect(result.booking?.bookingId).toBe('GLEBNY');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v1/trip/orders/modifyBooking');

    const requestInit = init as RequestInit;
    expect(requestInit.method).toBe('POST');
    const headers = requestInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse((requestInit.body as string) ?? '{}') as Record<string, unknown>;
    expect(body.confirmationId).toBe('GLEBNY');
    expect(body.bookingSignature).toBe('sig-abc');
    expect(body.retrieveBooking).toBe(false);
    expect(body.receivedFrom).toBe('Modify Booking');
  });

  it('surfaces a non-2xx response as SabreApiResponseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(
            JSON.stringify({
              errors: [{ category: 'CONFLICT', type: 'SIGNATURE_MISMATCH' }],
            }),
            { status: 409, statusText: 'Conflict' },
          ),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(
      client.bookingManagementV1.modifyBooking(minimalModifyInput),
    ).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 409,
    });
  });
});

describe('BookingManagementV1Service.cancelBooking', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const minimalCancelInput: CancelBookingInput = { confirmationId: 'GLEBNY' };

  const cancelResponseBody = {
    timestamp: '2026-05-01T12:00:00Z',
    voidedTickets: ['0017544536141'],
  };

  it('POSTs to the cancelBooking URL with bearer auth and JSON headers', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(JSON.stringify(cancelResponseBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    const result = await client.bookingManagementV1.cancelBooking(minimalCancelInput);

    expect(result.timestamp).toBe('2026-05-01T12:00:00Z');
    expect(result.voidedTickets).toEqual(['0017544536141']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v1/trip/orders/cancelBooking');

    const requestInit = init as RequestInit;
    expect(requestInit.method).toBe('POST');
    const headers = requestInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse((requestInit.body as string) ?? '{}') as Record<string, unknown>;
    expect(body.confirmationId).toBe('GLEBNY');
    expect(body.retrieveBooking).toBe(false);
    expect(body.cancelAll).toBe(false);
    expect(body.voidNonElectronicTickets).toBe(false);
    expect(body.errorHandlingPolicy).toBe('HALT_ON_ERROR');
    expect(body.refundDocumentsType).toBe('Tickets');
  });

  it('surfaces a non-2xx response as SabreApiResponseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(
            JSON.stringify({
              errors: [{ category: 'NOT_FOUND', type: 'BOOKING_NOT_FOUND' }],
            }),
            { status: 404, statusText: 'Not Found' },
          ),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(
      client.bookingManagementV1.cancelBooking(minimalCancelInput),
    ).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 404,
    });
  });
});

describe('BookingManagementV1Service.fulfillTickets', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const minimalFulfillInput: FulfillTicketsInput = {
    confirmationId: 'GLEBNY',
    fulfillments: [{}],
  };

  const fulfillResponseBody = {
    timestamp: '2026-05-01T12:00:00Z',
    tickets: [
      {
        number: '0167489825830',
        date: '2026-05-01',
        payment: { total: '150.00', currencyCode: 'USD' },
        ticketStatusName: 'Issued',
      },
    ],
  };

  it('POSTs to the fulfillFlightTickets URL with bearer auth and JSON headers', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(JSON.stringify(fulfillResponseBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    const result = await client.bookingManagementV1.fulfillTickets(minimalFulfillInput);

    expect(result.timestamp).toBe('2026-05-01T12:00:00Z');
    expect(result.tickets?.[0]?.number).toBe('0167489825830');
    expect(result.tickets?.[0]?.payment.total).toBe('150.00');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v1/trip/orders/fulfillFlightTickets');

    const requestInit = init as RequestInit;
    expect(requestInit.method).toBe('POST');
    const headers = requestInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse((requestInit.body as string) ?? '{}') as Record<string, unknown>;
    expect(body.confirmationId).toBe('GLEBNY');
    expect(body.fulfillments).toEqual([{}]);
    expect(body.retainAccounting).toBe(false);
    expect(body.receivedFrom).toBe('Fulfill Flight Tickets');
    expect(body.generateSingleInvoice).toBe(false);
    expect(body.commitTicketToBookingWaitTime).toBe(0);
    expect(body.acceptNegotiatedFare).toBe(true);
    expect(body.acceptPriceChanges).toBe(true);
  });

  it('surfaces a non-2xx response as SabreApiResponseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(
            JSON.stringify({
              errors: [{ category: 'BAD_REQUEST', type: 'INVALID_CONFIRMATION_ID' }],
            }),
            { status: 400, statusText: 'Bad Request' },
          ),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(
      client.bookingManagementV1.fulfillTickets(minimalFulfillInput),
    ).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
