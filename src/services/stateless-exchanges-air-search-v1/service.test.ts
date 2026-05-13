import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { SearchExchangeFlightsInput } from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const minimalInput: SearchExchangeFlightsInput = {
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

const responseBody = {
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
};

describe('StatelessExchangesAirSearchV1Service.search', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to /v1/dc/exchanges/getFlights with bearer auth, JSON headers, and the SEAS body', async () => {
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

    const result = await client.statelessExchangesAirSearchV1.search(minimalInput);

    expect(result.pricedItineraries).toHaveLength(1);
    const fare = result.pricedItineraries[0]?.airItineraryPricing?.fares[0];
    expect(fare?.totalPriceDifference?.differenceType).toBe('AddCollect');
    expect(fare?.totalPriceDifference?.totalBreakdown?.totalFees).toEqual([
      { amount: '50.00', currencyCode: 'USD', feeType: 'ChangeFees' },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v1/dc/exchanges/getFlights');

    const requestInit = init as RequestInit;
    expect(requestInit.method).toBe('POST');
    const headers = requestInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');

    const sentBody = JSON.parse(requestInit.body as string) as Record<string, unknown>;
    expect(sentBody.pnrLocator).toBe('LVKWZG');
    expect(sentBody.shoppingSource).toBe('ExchangeShop');
    // overrideCkinStatus default-send is the load-bearing protocol detail.
    expect(sentBody.overrideCkinStatus).toBe(false);
  });

  it('surfaces a non-2xx response as SabreApiResponseError via the baked-in error mapper', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(
            JSON.stringify({
              errors: [{ category: 'BAD_REQUEST', type: 'INVALID_PNR' }],
            }),
            { status: 400, statusText: 'Bad Request' },
          ),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.statelessExchangesAirSearchV1.search(minimalInput)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
