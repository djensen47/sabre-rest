import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

describe('MultiAirportCityLookupV1Service.lookup', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the correct Sabre URL with bearer auth and returns the mapped result', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(
          JSON.stringify({
            Cities: [
              {
                code: 'BER',
                name: 'Berlin',
                countryCode: 'DE',
                countryName: 'Germany',
                regionName: 'Europe',
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

    const result = await client.multiAirportCityLookupV1.lookup({ country: 'DE' });

    expect(result.cities).toEqual([
      {
        code: 'BER',
        name: 'Berlin',
        countryCode: 'DE',
        countryName: 'Germany',
        regionName: 'Europe',
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v1/lists/supported/cities?country=DE');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
  });

  it('omits the country param when called with no input', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(JSON.stringify({ Cities: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    const result = await client.multiAirportCityLookupV1.lookup();

    expect(result.cities).toEqual([]);
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v1/lists/supported/cities');
  });

  it('surfaces a non-2xx response as SabreApiResponseError via the baked-in error mapper', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(
            JSON.stringify({ message: "One of the 'country' has an unsupported value 'XX'." }),
            {
              status: 400,
              statusText: 'Bad Request',
            },
          ),
      ),
    );

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await expect(client.multiAirportCityLookupV1.lookup({ country: 'XX' })).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
