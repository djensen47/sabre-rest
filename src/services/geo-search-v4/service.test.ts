import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';
import type { GeoSearchInput } from './types.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

const searchInput: GeoSearchInput = {
  category: 'HOTEL',
  radius: 5,
  uom: 'KM',
  geoRef: { kind: 'geoCode', latitude: 32.877416, longitude: -96.959879 },
};

describe('GeoSearchV4Service.search', () => {
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
            GeoSearchRS: {
              GeoSearchResults: {
                Radius: 5,
                UOM: 'KM',
                Category: 'HOTEL',
                Latitude: 32.877416,
                Longitude: -96.959879,
                GeoSearchResult: [
                  {
                    Distance: 0.24,
                    Direction: 'N',
                    Name: 'MARRIOTT EXECUSTAY',
                    Id: '86034',
                    City: 'Irving',
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

    const result = await client.geoSearchV4.search(searchInput);

    expect(result.radius).toBe(5);
    expect(result.uom).toBe('KM');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      distance: 0.24,
      direction: 'N',
      name: 'MARRIOTT EXECUSTAY',
      id: '86034',
      city: 'Irving',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v4/geo/search');
    const req = init as RequestInit;
    expect(req.method).toBe('POST');
    const headers = req.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(req.body as string);
    expect(body.GeoSearchRQ.GeoRef.Category).toBe('HOTEL');
    expect(body.GeoSearchRQ.GeoRef.GeoCode).toEqual({
      Latitude: 32.877416,
      Longitude: -96.959879,
    });
  });

  it('surfaces a non-2xx response as SabreApiResponseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(JSON.stringify({ message: 'Bad Request' }), {
            status: 400,
            statusText: 'Bad Request',
          }),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.geoSearchV4.search(searchInput)).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
