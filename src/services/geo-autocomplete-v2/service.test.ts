import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../auth/types.js';
import { createSabreClient } from '../../client.js';

const fakeProvider = (): TokenProvider => ({
  getToken: vi.fn(async () => 'TEST_TOKEN'),
  invalidate: vi.fn(async () => {}),
});

describe('GeoAutocompleteV2Service.autocomplete', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the correct Sabre URL with bearer auth and returns the mapped result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          grouped: {
            'category:AIR': {
              matches: 1,
              doclist: {
                numFound: 1,
                start: 0,
                docs: [
                  {
                    id: 'DFW',
                    name: 'Dallas/Fort Worth Intl.',
                    city: 'Dallas',
                    country: 'US',
                    category: 'AIR',
                  },
                ],
              },
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

    const result = await client.geoAutocompleteV2.autocomplete({ query: 'Dall' });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.category).toBe('AIR');
    expect(result.groups[0]?.places[0]?.id).toBe('DFW');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cert.platform.sabre.com/v2/geo/autocomplete?query=Dall');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(headers.Accept).toBe('application/json');
  });

  it('includes optional query params when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ grouped: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createSabreClient({
      baseUrl: 'https://api.cert.platform.sabre.com',
      auth: fakeProvider(),
    });

    await client.geoAutocompleteV2.autocomplete({
      query: 'Lon',
      category: 'CITY',
      limit: 10,
      clientId: 'myapp',
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://api.cert.platform.sabre.com/v2/geo/autocomplete?query=Lon&category=CITY&limit=10&clientId=myapp',
    );
  });

  it('surfaces a non-2xx response as SabreApiResponseError via the baked-in error mapper', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ message: "Required string parameter 'query' is not present" }),
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

    await expect(client.geoAutocompleteV2.autocomplete({ query: 'Da' })).rejects.toMatchObject({
      name: 'SabreApiResponseError',
      statusCode: 400,
    });
  });
});
