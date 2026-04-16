import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { GetSeatsOfferInput } from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const minimalInput: GetSeatsOfferInput = {
  requestType: 'offerId',
  pointOfSale: { countryCode: 'US', cityCode: 'TPA' },
  offerId: 'OFFER-123',
};

const responseBody = {
  response: {
    seatMaps: [
      {
        paxSegmentRefID: 'SEG-1',
        cabinCompartments: [
          {
            seatRows: [{ row: 1, seats: [{ column: 'A' }] }],
          },
        ],
      },
    ],
  },
};

describe('GetSeatsV2Service.getSeats', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the getseats URL with bearer auth and JSON headers', async () => {
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

    const result = await client.getSeatsV2.getSeats(minimalInput);

    expect(result.seatMaps).toHaveLength(1);
    expect(result.seatMaps[0]?.paxSegmentRefId).toBe('SEG-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v1/offers/getseats');

    const requestInit = init as RequestInit;
    expect(requestInit.method).toBe('POST');
    const headers = requestInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');

    const sentBody = JSON.parse(requestInit.body as string) as Record<string, unknown>;
    expect(sentBody.requestType).toBe('offerId');
  });

  it('surfaces a non-2xx response as SabreApiResponseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(JSON.stringify({ errors: [{ descriptionText: 'Offer not found' }] }), {
            status: 404,
            statusText: 'Not Found',
          }),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.getSeatsV2.getSeats(minimalInput)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 404,
    });
  });
});
