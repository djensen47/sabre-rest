import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { FlightReshopInput } from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const input: FlightReshopInput = {
  journeys: [
    {
      departureLocation: { cityCode: 'DFW' },
      arrivalLocation: { cityCode: 'LAX' },
      departureDate: '2026-09-26',
    },
  ],
  tickets: [{ number: '0012972101507' }],
};

describe('FlightReshopV1Service.reshop', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to /v1/offers/flightReshop with bearer auth and returns a mapped output', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(
          JSON.stringify({
            timestamp: '2026-12-23T14:32:04.986Z',
            numberOfOffers: 1,
            offers: [
              {
                id: 'offer-1',
                source: { distributionModel: 'ATPCO' },
                journeyRefs: ['j-1'],
                isPriceGuaranteed: true,
                totalPriceDifference: {
                  type: 'Add collect',
                  baseFare: '120.00',
                  grandTotal: '148.00',
                  currencyCode: 'USD',
                },
                items: [],
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    const result = await client.flightReshopV1.reshop(input);

    expect(result.numberOfOffers).toBe(1);
    expect(result.offers?.[0]?.id).toBe('offer-1');
    expect(result.offers?.[0]?.isPriceGuaranteed).toBe(true);
    expect(result.offers?.[0]?.totalPriceDifference?.grandTotal).toBe('148.00');
    expect(result.offers?.[0]?.totalPriceDifference?.type).toBe('Add collect');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v1/offers/flightReshop');
    const req = init as RequestInit;
    expect(req.method).toBe('POST');
    const headers = req.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(req.body as string);
    expect(body.journeys).toHaveLength(1);
    expect(body.journeys[0].departureLocation).toEqual({ cityCode: 'DFW' });
    expect(body.tickets[0].number).toBe('0012972101507');
  });

  it('surfaces the downline error on an HTTP 200 with no offers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(
            JSON.stringify({
              timestamp: '2026-06-04T15:18:10.601Z',
              errors: [
                {
                  category: 'APPLICATION_ERROR',
                  type: 'DOWNLINE_SERVICE_ERROR',
                  description:
                    'The ExchangeShoppingRQ service returned an error: (Automated reissue not active for this ticket).',
                },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    const result = await client.flightReshopV1.reshop(input);
    expect(result.offers).toBeUndefined();
    expect(result.errors?.[0]?.type).toBe('DOWNLINE_SERVICE_ERROR');
    expect(result.errors?.[0]?.description).toContain('Automated reissue not active');
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

    await expect(client.flightReshopV1.reshop(input)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
