import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { CreateBookingInput, GetBookingInput } from './types.js';

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
