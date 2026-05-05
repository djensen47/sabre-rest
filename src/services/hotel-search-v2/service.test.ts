import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { SearchHotelsInput } from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const geoInput: SearchHotelsInput = {
  geoSearch: {
    geoRef: { kind: 'geoCode', radius: 25, uom: 'MI', latitude: 32.758, longitude: -97.08 },
  },
};

describe('HotelSearchV2Service.search', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the correct URL with bearer auth and returns the mapped result', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(
          JSON.stringify({
            HotelSearchRS: {
              ApplicationResults: { status: 'Complete' },
              HotelSearchInfos: {
                MaxSearchResults: 1,
                HotelSearchInfo: [
                  {
                    HotelInfo: {
                      HotelCode: '100072188',
                      CodeContext: 'GLOBAL',
                      HotelName: 'Hyatt Regency Tulsa',
                    },
                  },
                ],
              },
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

    const result = await client.hotelSearchV2.search(geoInput);

    expect(result.maxSearchResults).toBe(1);
    expect(result.hotels).toEqual([
      { code: '100072188', codeContext: 'GLOBAL', name: 'Hyatt Regency Tulsa' },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v2.0.0/hotel/search');
    const req = init as RequestInit;
    expect(req.method).toBe('POST');
    const headers = req.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(req.body as string);
    expect(body.HotelSearchRQ.SearchCriteria.GeoSearch.GeoRef.GeoCode).toEqual({
      Latitude: 32.758,
      Longitude: -97.08,
    });
  });

  it('surfaces a non-2xx response as SabreApiResponseError via the baked-in error mapper', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(JSON.stringify({ message: 'No results were found.' }), {
            status: 404,
            statusText: 'Not Found',
          }),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.hotelSearchV2.search(geoInput)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 404,
    });
  });
});
