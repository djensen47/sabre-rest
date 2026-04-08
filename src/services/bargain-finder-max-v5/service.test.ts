import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { SearchBargainFinderMaxInput } from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const minimalInput: SearchBargainFinderMaxInput = {
  originDestinations: [{ from: 'JFK', to: 'LHR', departureDateTime: '2025-12-25T10:00:00' }],
  passengers: [{ type: 'ADT', quantity: 1 }],
  pointOfSale: { companyCode: 'TN' },
};

const responseBody = {
  groupedItineraryResponse: {
    version: 'V5',
    messages: [],
    scheduleDescs: [
      {
        id: 1,
        carrier: { marketing: 'BA', marketingFlightNumber: 178 },
        departure: { airport: 'JFK', time: '21:00:00' },
        arrival: { airport: 'LHR', time: '09:00:00', dateAdjustment: 1 },
      },
    ],
    legDescs: [{ id: 10, schedules: [{ ref: 1 }] }],
    itineraryGroups: [
      {
        groupDescription: { legDescriptions: [{ departureDate: '2025-12-25' }] },
        itineraries: [
          {
            id: 1,
            pricingSource: 'ADVJR1',
            legs: [{ ref: 10 }],
            pricingInformation: [
              {
                fare: {
                  passengerInfoList: [],
                  totalFare: { totalPrice: 999, currency: 'USD' },
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

describe('BargainFinderMaxV5Service.search', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the BFM v5 shop URL with bearer auth, JSON headers, and the OTA body', async () => {
    // Use mockImplementation so each call returns a fresh Response — bodies
    // are streams that can only be read once.
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

    const result = await client.bargainFinderMaxV5.search(minimalInput);

    expect(result.itineraries).toHaveLength(1);
    expect(result.itineraries[0]?.totalFare).toEqual({ totalAmount: 999, currency: 'USD' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v5/offers/shop');

    const requestInit = init as RequestInit;
    expect(requestInit.method).toBe('POST');
    const headers = requestInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');

    const sentBody = JSON.parse(requestInit.body as string) as Record<string, unknown>;
    expect(sentBody.OTA_AirLowFareSearchRQ).toBeDefined();
  });

  it('surfaces a non-2xx response as SabreApiResponseError via the baked-in error mapper', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(
            JSON.stringify({
              OTA_AirLowFareSearchRS: {
                Errors: { Error: [{ Type: 'Application', ShortText: 'Invalid PCC' }] },
              },
            }),
            { status: 400, statusText: 'Bad Request' },
          ),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.bargainFinderMaxV5.search(minimalInput)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
