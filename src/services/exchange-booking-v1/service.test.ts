import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { ExchangeFlightInput } from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const input: ExchangeFlightInput = {
  pnrLocator: 'IJNPIE',
  originalTicketNumber: '0277173836173',
  receivedFrom: 'SP TEST',
  cancelSegments: [1, 2],
  newSegments: [
    {
      origin: 'LAS',
      destination: 'PDX',
      departureDateTime: '2026-05-03T06:00:00',
      arrivalDateTime: '2026-05-03T08:19:00',
      marketingCarrier: 'AS',
      flightNumber: '781',
      bookingClass: 'G',
    },
  ],
  priceTolerance: {
    amountSpecified: 0,
    acceptableIncrease: { amount: 10, haltOnNonAcceptablePrice: true },
  },
};

describe('ExchangeBookingV1Service.exchange', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to /v1.1.0/exchange/booking with bearer auth and returns a mapped output', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(
          JSON.stringify({
            ExchangeBookingRS: {
              ApplicationResults: { status: 'Complete' },
              ExchangeConfirmation: [{ PQR_Number: '02' }],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    const result = await client.exchangeBookingV1.exchange(input);

    expect(result.applicationResults?.status).toBe('Complete');
    expect(result.exchangeConfirmations?.[0]?.pqrNumber).toBe('02');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v1.1.0/exchange/booking');
    const req = init as RequestInit;
    expect(req.method).toBe('POST');
    const headers = req.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(req.body as string);
    expect(body.ExchangeBookingRQ.version).toBe('1.1.0');
    expect(body.ExchangeBookingRQ.Itinerary).toEqual({ id: 'IJNPIE' });
    expect(body.ExchangeBookingRQ.AutomatedExchanges).toHaveLength(1);
  });

  it('surfaces a non-2xx response as SabreApiResponseError via the baked-in error mapper', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(JSON.stringify({ message: 'Bad request' }), {
            status: 400,
            statusText: 'Bad Request',
          }),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.exchangeBookingV1.exchange(input)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
